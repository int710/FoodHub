import { redis } from '~/config/redis'
import HTTP_STATUS from '~/constants/httpStatus'
import { RedisKey } from '~/constants/redis'
import { ErrorWithStatus } from '~/models/Errors'
import { CartItem, UpdateDetailItemType } from '~/models/schemas/order.schema'
import { metadataType } from '~/models/types'

export enum CartType {
  DINE_IN = 'dine-in',
  TAKEAWAY = 'takeaway',
  DELIVERY = 'delivery'
}

const ITEM_PREFIX = 'item:'
const META_FIELD = 'metadata'

const getSig = (ids: string[] = []) => [...(ids || [])].sort().join(',')

class CartServices {
  private getKey(type: CartType, ownerId: string) {
    // Nếu bạn đã có RedisKey.cart(type, ownerId) thì dùng luôn
    // còn không thì dùng tạm format này: cart:dine-in:table_xxx
    return RedisKey.cart ? RedisKey.cart(type, ownerId) : `cart:${type}:${ownerId}`
  }

  private parse<T>(val: any): T | null {
    if (!val) return null
    if (typeof val !== 'string') return val as T
    try { return JSON.parse(val) as T } catch { return null }
  }

  private getTTL(type: CartType) {
    if (type === CartType.TAKEAWAY) return 1800 // 30p
    if (type === CartType.DINE_IN) return 14400 // 4h
    return 7 * 24 * 3600 // delivery 7 ngày
  }

  async getCart(type: CartType, ownerId: string) {
    const key = this.getKey(type, ownerId)
    const rawData = await redis.hgetall(key)

    if (!rawData || Object.keys(rawData).length === 0) {
      return {
        items: [] as CartItem[],
        metadata: {
          type,
          ownerId,
          tableId: type === CartType.DINE_IN ? ownerId : undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          totalQuantity: 0
        } as metadataType & { type: CartType; ownerId: string }
      }
    }

    const items: CartItem[] = []
    let metadata = {} as any
    for (const [field, value] of Object.entries(rawData)) {
      if (field.startsWith(ITEM_PREFIX)) {
        const it = this.parse<CartItem>(value)
        if (it) items.push(it)
      } else if (field === META_FIELD) {
        metadata = this.parse(value) || {}
      }
    }
    items.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
    return { items, metadata }
  }

  async addItemToCart(type: CartType, ownerId: string, dto: CartItem, addedBy: string) {
    const key = this.getKey(type, ownerId)
    const currentCart = await this.getCart(type, ownerId)
    const sig = getSig(dto.variantOptionIds)

    const found = currentCart.items.find(
      (i) => i.menuItemId === dto.menuItemId && getSig(i.variantOptionIds) === sig && (i.note || '') === (dto.note || '')
    )

    if (found) {
      found.quantity += dto.quantity
      await redis.hset(key, `${ITEM_PREFIX}${found.id}`, JSON.stringify(found))
    } else {
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        ...dto,
        note: dto.note || '',
        variantOptionIds: dto.variantOptionIds || [],
        addedBy, // dine-in mới cần, delivery thì chính là ownerId
        addedAt: Date.now()
      }
      currentCart.items.push(newItem)
      await redis.hset(key, `${ITEM_PREFIX}${newItem.id}`, JSON.stringify(newItem))
    }

    const metadata = {
      type,
      ownerId,
      tableId: type === CartType.DINE_IN ? ownerId : undefined,
      createdAt: currentCart.metadata.createdAt || Date.now(),
      updatedAt: Date.now(),
      totalQuantity: currentCart.items.reduce((sum, it) => sum + it.quantity, 0)
    }
    await redis.hset(key, META_FIELD, JSON.stringify(metadata))
    await redis.expire(key, this.getTTL(type))

    return { items: currentCart.items, metadata }
  }

  async updateItem(type: CartType, ownerId: string, itemId: string, dto: UpdateDetailItemType) {
    const key = this.getKey(type, ownerId)
    const field = `${ITEM_PREFIX}${itemId}`
    const raw = await redis.hget(key, field)
    const item = this.parse<CartItem>(raw)

    if (!item) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Item không tồn tại trong giỏ'
      })
    }

    const oldQty = item.quantity
    const metaRaw = await redis.hget(key, META_FIELD)
    const meta = this.parse<metadataType>(metaRaw) || ({ totalQuantity: 0 } as any)

    // 1. Đường nhanh - chỉ đổi quantity
    const isOnlyQuantity = Object.keys(dto).length === 1 && dto.quantity !== undefined
    if (isOnlyQuantity) {
      item.quantity = dto.quantity!
      await redis.hset(key, field, JSON.stringify(item))
      const newMeta = { ...meta, type, ownerId, updatedAt: Date.now(), totalQuantity: meta.totalQuantity - oldQty + dto.quantity! }
      await redis.hset(key, META_FIELD, JSON.stringify(newMeta))
      return { action: 'updated' as const, item }
    }

    // 2. Đường đủ - đổi note / variant
    if (dto.quantity !== undefined) item.quantity = dto.quantity
    if (dto.note !== undefined) item.note = dto.note
    if (dto.variantOptionIds !== undefined) item.variantOptionIds = dto.variantOptionIds

    const sig = getSig(item.variantOptionIds)
    const currentCart = await this.getCart(type, ownerId)

    const existingMatch = currentCart.items.find(
      (i) => i.id !== itemId && i.menuItemId === item.menuItemId && getSig(i.variantOptionIds) === sig && (i.note || '') === (item.note || '')
    )

    let finalItem = item
    if (existingMatch) {
      existingMatch.quantity += item.quantity
      await redis.hset(key, `${ITEM_PREFIX}${existingMatch.id}`, JSON.stringify(existingMatch))
      await redis.hdel(key, field)
      finalItem = existingMatch
    } else {
      await redis.hset(key, field, JSON.stringify(item))
    }

    const newMeta = {
      ...meta,
      type,
      ownerId,
      updatedAt: Date.now(),
      totalQuantity: meta.totalQuantity - oldQty + item.quantity
    }
    await redis.hset(key, META_FIELD, JSON.stringify(newMeta))
    await redis.expire(key, this.getTTL(type))

    return { action: existingMatch ? ('merged' as const) : ('updated' as const), item: finalItem }
  }

  async deleteItem(type: CartType, ownerId: string, itemId: string) {
    const key = this.getKey(type, ownerId)
    const field = `${ITEM_PREFIX}${itemId}`
    const raw = await redis.hget(key, field)
    const item = this.parse<CartItem>(raw)
    if (!item) return

    await redis.hdel(key, field)
    const metaRaw = await redis.hget(key, META_FIELD)
    const meta = this.parse<any>(metaRaw)
    if (meta) {
      meta.totalQuantity = Math.max(0, meta.totalQuantity - item.quantity)
      meta.updatedAt = Date.now()
      await redis.hset(key, META_FIELD, JSON.stringify(meta))
    }
  }

  async clearCart(type: CartType, ownerId: string) {
    await redis.del(this.getKey(type, ownerId))
  }
}

const cartsServices = new CartServices()
export default cartsServices