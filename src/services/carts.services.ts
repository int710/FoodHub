import { redis } from '~/config/redis'
import { RedisKey } from '~/constants/redis'
import { CartItem } from '~/models/schemas/order.schema'

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
}
const cartsServices = new CartServices()
export default cartsServices
