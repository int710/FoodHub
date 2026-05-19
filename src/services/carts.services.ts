import { redis } from '~/config/redis'
import HTTP_STATUS from '~/constants/httpStatus'
import { RedisKey } from '~/constants/redis'
import { ErrorWithStatus } from '~/models/Errors'
import { CartItem, UpdateDetailItemType } from '~/models/schemas/order.schema'
import { metadataType } from '~/models/types'

const ITEM_PREFIX = 'item:'

class CartServices {
  async getCart(tableId: string) {
    const rawData = await redis.hgetall(RedisKey.cartTable(tableId))
    if (!rawData || Object.keys(rawData).length === 0) {
      return { items: [], metadata: { tableId, createdAt: Date.now(), updatedAt: Date.now(), totalQuantity: 0 } }
    }

    const items: CartItem[] = []
    let metadata = { tableId, createdAt: Date.now(), updatedAt: Date.now(), totalQuantity: 0 }
    for (const [field, value] of Object.entries(rawData)) {
      if (field.startsWith(ITEM_PREFIX)) {
        items.push(JSON.parse(value) as CartItem)
      } else if (field === 'metadata') {
        metadata = JSON.parse(value)
      }
    }
    items.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
    return { items, metadata }
  }

  async addItemToCart(tableId: string, dto: CartItem, addedBy: string) {
    const key = await RedisKey.cartTable(tableId)
    const currentCart = await this.getCart(tableId)
    const sig = (dto.variantOptionIds || []).sort().join(',')
    const found = currentCart.items.find(
      (i: CartItem) =>
        i.menuItemId === dto.menuItemId && i.variantOptionIds.sort().join(',') === sig && i.note === dto.note
    )
    if (found) {
      found.quantity += dto.quantity
      await redis.hset(key, `${ITEM_PREFIX}${found.id}`, found)
    } else {
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        ...dto,
        variantOptionIds: dto.variantOptionIds || [],
        addedBy,
        addedAt: Date.now()
      }
      currentCart.items.push(newItem)
      await redis.hset(key, `${ITEM_PREFIX}${newItem.id}`, newItem)
    }

    const metadata = {
      tableId,
      createdAt: currentCart.metadata.createdAt || Date.now(),
      updatedAt: Date.now(),
      totalQuantity: currentCart.items.reduce((sum, it) => sum + it.quantity, 0)
    }
    await redis.hset(key, 'metadata', metadata)

    return { items: currentCart.items, metadata }
  }

  async updateItem(tableId: string, itemId: string, dto: UpdateDetailItemType) {
    const key = await RedisKey.cartTable(tableId)
    const field = `${ITEM_PREFIX}${itemId}`
    const item = await redis.hget<CartItem>(key, field)
    if (!item) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Item không tồn tại trong giỏ'
      })
    }

    const oldQty = item.quantity

    // Nếu chỉ update số lượng
    const isOnlyQuantity = Object.entries(dto).length === 1 && dto.quantity !== undefined
    if (isOnlyQuantity) {
      item.quantity = dto.quantity!
      await redis.hset(key, field, item)

      const metaRaw = (await redis.hget<metadataType>(key, 'metadata')) as metadataType
      const qlt = metaRaw.totalQuantity - oldQty + dto.quantity!
      const newMeta: metadataType = { ...metaRaw, updatedAt: Date.now(), totalQuantity: qlt }
      await redis.hset(key, 'metadata', newMeta)
      return { action: 'updated', item }
    }

    // Update chi tiết
    const currentCart = await this.getCart(tableId)
    item.quantity = dto.quantity ?? item.quantity
    if (dto.note !== undefined) item.note = dto.note
    if (dto.variantOptionIds !== undefined) item.variantOptionIds = dto.variantOptionIds

    const sig = (item.variantOptionIds || []).sort().join(',')

    // Kiểm tra xem sau khi đổi detail, có bị trùng với một món KHÁC đang có trong giỏ không
    const existingMatch = currentCart.items.find(
      (i: CartItem) =>
        i.id !== itemId &&
        i.menuItemId === item.menuItemId &&
        (i.variantOptionIds || []).sort().join(',') === sig &&
        i.note === item.note
    )

    let finalItem = item

    if (existingMatch) {
      // Nếu trùng: cộng dồn số lượng vào thằng vừa tìm thấy và xóa bản ghi của thằng cũ đi
      existingMatch.quantity += item.quantity
      await redis.hset(key, `${ITEM_PREFIX}${existingMatch.id}`, existingMatch)
      await redis.hdel(key, field)
      finalItem = existingMatch
    } else {
      await redis.hset(key, field, item)
    }

    const metaRaw = (await redis.hget<metadataType>(key, 'metadata')) as metadataType
    const qlt = metaRaw.totalQuantity - oldQty + item.quantity
    const newMeta: metadataType = { ...metaRaw, updatedAt: Date.now(), totalQuantity: qlt }
    await redis.hset(key, 'metadata', newMeta)

    return { action: existingMatch ? 'merged' : 'updated', item: finalItem }
  }
}
const cartsServices = new CartServices()
export default cartsServices
