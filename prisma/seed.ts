import 'dotenv/config'
import mongoose from 'mongoose'
import { Prisma } from '../src/generated/prisma/client'
import {
  ItemStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Role
} from '../src/generated/prisma/enums'
import { prisma } from '../src/config/prisma'
import { connectMongodb } from '../src/config/mongodb'
import {
  NotificationModel,
  NotificationRecipientRole,
  NotificationType
} from '../src/models/mongodb/notification.model'
import { ConversationModel, ConversationStatus } from '../src/models/mongodb/conversation.model'
import { MessageModel, MessageType, SenderRole } from '../src/models/mongodb/message.model'

const DATASET = 'ops-v2'
const SESSION_PREFIX = `${DATASET}:session:`
const money = (value: number) => new Prisma.Decimal(value.toFixed(2))
const daysAgo = (days: number, hour: number, minute = 0) => {
  const value = new Date()
  value.setDate(value.getDate() - days)
  value.setHours(hour, minute, 0, 0)
  return value
}

const tableDefinitions = [
  { name: 'Bàn 01', capacity: 2, floor: 'Tầng 1 - Khu cửa sổ' },
  { name: 'Bàn 02', capacity: 2, floor: 'Tầng 1 - Khu cửa sổ' },
  { name: 'Bàn 03', capacity: 4, floor: 'Tầng 1 - Khu trung tâm' },
  { name: 'Bàn 04', capacity: 4, floor: 'Tầng 1 - Khu trung tâm' },
  { name: 'Bàn 05', capacity: 6, floor: 'Tầng 1 - Khu gia đình' },
  { name: 'Bàn 06', capacity: 6, floor: 'Tầng 1 - Khu gia đình' },
  { name: 'Bàn 07', capacity: 2, floor: 'Tầng 2 - Ban công' },
  { name: 'Bàn 08', capacity: 4, floor: 'Tầng 2 - Ban công' },
  { name: 'Bàn 09', capacity: 8, floor: 'Tầng 2 - Phòng riêng' },
  { name: 'Bàn 10', capacity: 8, floor: 'Tầng 2 - Phòng riêng' },
  { name: 'Bàn 11', capacity: 4, floor: 'Ngoài trời' },
  { name: 'Bàn 12', capacity: 4, floor: 'Ngoài trời' }
]

type OrderDefinition = {
  type: OrderType
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  daysAgo: number
  hour: number
  tableIndex?: number
  customerIndex?: number
  note?: string
  cancelReason?: string
}

const orderDefinitions: OrderDefinition[] = [
  { type: OrderType.DINE_IN, status: OrderStatus.PENDING_CONFIRMATION, paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.UNPAID, daysAgo: 0, hour: 18, tableIndex: 0, customerIndex: 0, note: 'Ít cay, cho nước chấm riêng.' },
  { type: OrderType.DINE_IN, status: OrderStatus.CONFIRMED, paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.UNPAID, daysAgo: 0, hour: 17, tableIndex: 2, customerIndex: 1 },
  { type: OrderType.DINE_IN, status: OrderStatus.PREPARING, paymentMethod: PaymentMethod.ZALOPAY, paymentStatus: PaymentStatus.PAID, daysAgo: 0, hour: 16, tableIndex: 4, customerIndex: 2, note: 'Ưu tiên món cho trẻ em trước.' },
  { type: OrderType.DINE_IN, status: OrderStatus.READY, paymentMethod: PaymentMethod.VNPAY, paymentStatus: PaymentStatus.PAID, daysAgo: 0, hour: 15, tableIndex: 6, customerIndex: 0 },
  { type: OrderType.DINE_IN, status: OrderStatus.SERVED, paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.UNPAID, daysAgo: 0, hour: 14, tableIndex: 8, customerIndex: 1 },
  { type: OrderType.TAKEAWAY, status: OrderStatus.PENDING_PAYMENT, paymentMethod: PaymentMethod.ZALOPAY, paymentStatus: PaymentStatus.PENDING, daysAgo: 0, hour: 13, customerIndex: 2 },
  { type: OrderType.TAKEAWAY, status: OrderStatus.PENDING_CONFIRMATION, paymentMethod: PaymentMethod.VNPAY, paymentStatus: PaymentStatus.PAID, daysAgo: 0, hour: 12, customerIndex: 0, note: 'Đóng gói riêng đồ uống.' },
  { type: OrderType.DELIVERY, status: OrderStatus.PREPARING, paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.UNPAID, daysAgo: 0, hour: 11, customerIndex: 1, note: 'Gọi trước khi giao.' },
  { type: OrderType.DELIVERY, status: OrderStatus.READY, paymentMethod: PaymentMethod.ZALOPAY, paymentStatus: PaymentStatus.PAID, daysAgo: 1, hour: 19, customerIndex: 2 },
  { type: OrderType.TAKEAWAY, status: OrderStatus.COMPLETED, paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PAID, daysAgo: 1, hour: 12, customerIndex: 0 },
  { type: OrderType.DINE_IN, status: OrderStatus.COMPLETED, paymentMethod: PaymentMethod.VNPAY, paymentStatus: PaymentStatus.PAID, daysAgo: 2, hour: 19, tableIndex: 1, customerIndex: 1 },
  { type: OrderType.DELIVERY, status: OrderStatus.COMPLETED, paymentMethod: PaymentMethod.MOMO, paymentStatus: PaymentStatus.PAID, daysAgo: 4, hour: 11, customerIndex: 2 },
  { type: OrderType.DELIVERY, status: OrderStatus.CANCELLED, paymentMethod: PaymentMethod.VNPAY, paymentStatus: PaymentStatus.REFUNDED, daysAgo: 5, hour: 18, customerIndex: 0, cancelReason: 'Khách yêu cầu đổi địa chỉ ngoài khu vực giao hàng.' },
  { type: OrderType.TAKEAWAY, status: OrderStatus.CANCELLED, paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.UNPAID, daysAgo: 7, hour: 10, customerIndex: 1, cancelReason: 'Khách không thể đến nhận món.' },
  { type: OrderType.DINE_IN, status: OrderStatus.PAYMENT_FAILED, paymentMethod: PaymentMethod.ZALOPAY, paymentStatus: PaymentStatus.FAILED, daysAgo: 8, hour: 20, tableIndex: 3, customerIndex: 2 },
  { type: OrderType.DINE_IN, status: OrderStatus.COMPLETED, paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PAID, daysAgo: 14, hour: 18, tableIndex: 5, customerIndex: 0 },
  { type: OrderType.TAKEAWAY, status: OrderStatus.COMPLETED, paymentMethod: PaymentMethod.ZALOPAY, paymentStatus: PaymentStatus.PAID, daysAgo: 21, hour: 8, customerIndex: 1 },
  { type: OrderType.DELIVERY, status: OrderStatus.COMPLETED, paymentMethod: PaymentMethod.VNPAY, paymentStatus: PaymentStatus.PAID, daysAgo: 30, hour: 12, customerIndex: 2 }
]

function statusTimeline(status: OrderStatus, createdAt: Date) {
  const at = (minutes: number) => new Date(createdAt.getTime() + minutes * 60_000)
  const confirmed = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED, OrderStatus.COMPLETED].includes(status)
  const ready = [OrderStatus.READY, OrderStatus.SERVED, OrderStatus.COMPLETED].includes(status)
  const served = [OrderStatus.SERVED, OrderStatus.COMPLETED].includes(status)
  return { confirmAt: confirmed ? at(4) : null, readyAt: ready ? at(28) : null, servedAt: served ? at(35) : null }
}

function itemStatusFor(orderStatus: OrderStatus, index: number): ItemStatus {
  if ([OrderStatus.SERVED, OrderStatus.COMPLETED].includes(orderStatus)) return ItemStatus.SERVED
  if (orderStatus === OrderStatus.READY) return ItemStatus.READY
  if (orderStatus === OrderStatus.PREPARING) return index === 0 ? ItemStatus.READY : ItemStatus.PREPARING
  if (orderStatus === OrderStatus.CONFIRMED) return index === 0 ? ItemStatus.PREPARING : ItemStatus.WAITING
  return ItemStatus.WAITING
}

async function clearOperationalData() {
  await prisma.$transaction([
    prisma.review.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.table.deleteMany()
  ])
}

async function seedMongoData(
  orders: Array<{ id: string; orderCode: string; customerId: string | null; status: OrderStatus }>,
  customers: Array<{ id: string; name: string }>,
  hosts: Array<{ id: string; role: Role }>
) {
  await connectMongodb()
  await Promise.all([
    NotificationModel.deleteMany({}),
    MessageModel.deleteMany({}),
    ConversationModel.deleteMany({})
  ])

  const notifications = orders.flatMap((order, index) => {
    const common = { orderId: order.id, orderCode: order.orderCode, metadata: {}, expiresAt: new Date(Date.now() + 180 * 86_400_000) }
    const hostNotifications = hosts.map((host) => ({
      ...common,
      recipientId: host.id,
      recipientRole: host.role === Role.ADMIN ? NotificationRecipientRole.ADMIN : NotificationRecipientRole.STAFF,
      type: NotificationType.ORDER_CREATED,
      title: 'Có đơn hàng mới',
      message: `Đơn ${order.orderCode} đang chờ xử lý.`,
      dedupeKey: `${DATASET}:${order.id}:host:${host.id}`,
      readAt: index % 3 === 0 ? new Date() : null
    }))
    if (!order.customerId) return hostNotifications
    const customerType = order.status === OrderStatus.CANCELLED
      ? NotificationType.ORDER_CANCELLED
      : order.status === OrderStatus.COMPLETED
        ? NotificationType.ORDER_COMPLETED
        : order.status === OrderStatus.READY
          ? NotificationType.ORDER_READY
          : NotificationType.ORDER_CONFIRMED
    return [...hostNotifications, {
      ...common,
      recipientId: order.customerId,
      recipientRole: NotificationRecipientRole.CUSTOMER,
      type: customerType,
      title: order.status === OrderStatus.READY ? 'Đơn hàng đã sẵn sàng' : order.status === OrderStatus.CANCELLED ? 'Đơn hàng đã hủy' : 'Cập nhật đơn hàng',
      message: `Đơn ${order.orderCode} hiện ở trạng thái ${order.status.replaceAll('_', ' ').toLowerCase()}.`,
      dedupeKey: `${DATASET}:${order.id}:customer`,
      readAt: index % 4 === 0 ? new Date() : null
    }]
  })
  if (notifications.length) await NotificationModel.insertMany(notifications)

  const chatScripts = [
    ['Xin chào, quán có thể cho mình xin thêm nước chấm không?', 'Dạ được ạ, nhân viên sẽ mang ra bàn ngay.', 'Cảm ơn quán nhé!'],
    ['Cho mình hỏi đơn mang về khoảng bao lâu thì xong?', 'Đơn của bạn dự kiến hoàn thành trong khoảng 15 phút ạ.', 'Mình đã rõ, cảm ơn bạn.'],
    ['Mình muốn đổi đồ uống trong combo được không?', 'Dạ được, bạn cho quán biết đồ uống muốn đổi nhé.', 'Cho mình đổi sang trà đào ạ.']
  ]
  for (const [index, customer] of customers.slice(0, 3).entries()) {
    let conversation = await ConversationModel.findOne({ customerId: customer.id, status: ConversationStatus.OPEN })
    if (!conversation) {
      conversation = await ConversationModel.create({
        customerId: customer.id,
        status: ConversationStatus.OPEN,
        assignedHostId: hosts[0]?.id ?? null,
        assignedAt: hosts[0] ? daysAgo(index, 10 + index) : null
      })
    }
    const script = chatScripts[index]
    for (const [messageIndex, content] of script.entries()) {
      const senderIsCustomer = messageIndex !== 1
      const senderId = senderIsCustomer ? customer.id : hosts[0]?.id
      if (!senderId) continue
      const exists = await MessageModel.exists({ conversationId: conversation._id, content })
      if (!exists) {
        await MessageModel.create({
          conversationId: conversation._id,
          senderId,
          senderRole: senderIsCustomer ? SenderRole.CUSTOMER : hosts[0].role === Role.ADMIN ? SenderRole.ADMIN : SenderRole.STAFF,
          content,
          type: MessageType.TEXT,
          createdAt: daysAgo(index, 10 + index, messageIndex * 3)
        })
      }
    }
    const lastMessage = script.at(-1)!
    await ConversationModel.updateOne({ _id: conversation._id }, { $set: { lastMessage, lastMessageSenderId: customer.id, lastMessageAt: daysAgo(index, 10 + index, 6) } })
  }
}

async function main() {
  const [customers, hosts, menuItems] = await Promise.all([
    prisma.user.findMany({ where: { role: Role.CUSTOMER, isActive: true }, select: { id: true, name: true }, orderBy: { createdAt: 'asc' } }),
    prisma.user.findMany({ where: { role: { in: [Role.ADMIN, Role.STAFF] }, isActive: true }, select: { id: true, role: true }, orderBy: { createdAt: 'asc' } }),
    prisma.menuItem.findMany({ where: { isAvailable: true }, select: { id: true, name: true, basePrice: true, description: true, image: true }, orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }] })
  ])

  if (!customers.length) throw new Error('Cần ít nhất một CUSTOMER có sẵn. Seed không tự tạo hoặc sửa user.')
  if (!hosts.length) throw new Error('Cần ít nhất một ADMIN/STAFF có sẵn. Seed không tự tạo hoặc sửa user.')
  if (menuItems.length < 3) throw new Error('Cần ít nhất ba món đang bán. Seed không tự tạo hoặc sửa menu/món ăn.')

  await clearOperationalData()
  const tables = await Promise.all(tableDefinitions.map((table) => prisma.table.upsert({ where: { name: table.name }, create: { ...table, isActive: true }, update: {} })))

  const orders = []
  for (const [index, definition] of orderDefinitions.entries()) {
    const customer = customers[definition.customerIndex! % customers.length]
    const createdAt = daysAgo(definition.daysAgo, definition.hour, (index * 7) % 60)
    const selectedItems = Array.from({ length: 2 + (index % 3) }, (_, itemIndex) => menuItems[(index * 2 + itemIndex) % menuItems.length])
    const items = selectedItems.map((item, itemIndex) => {
      const quantity = 1 + ((index + itemIndex) % 2)
      const unitPrice = Number(item.basePrice)
      return { item, quantity, subTotal: unitPrice * quantity, status: itemStatusFor(definition.status, itemIndex) }
    })
    const subtotal = items.reduce((total, item) => total + item.subTotal, 0)
    const vatAmount = Math.round(subtotal * 0.08)
    const totalAmount = subtotal + vatAmount
    const timeline = statusTimeline(definition.status, createdAt)
    const isPaid = [PaymentStatus.PAID, PaymentStatus.REFUNDED].includes(definition.paymentStatus)
    const suffix = (index + 1).toString(36).padStart(4, '0').toUpperCase()
    const orderCode = `FHUB_${createdAt.getTime()}_${suffix}`
    const order = await prisma.order.create({
      data: {
        orderCode,
        pickupCode: definition.type === OrderType.TAKEAWAY ? `FH${String(240 + index).padStart(3, '0')}` : null,
        sessionId: `${SESSION_PREFIX}${index + 1}`,
        type: definition.type,
        status: definition.status,
        customerId: customer.id,
        tableId: definition.type === OrderType.DINE_IN ? tables[definition.tableIndex! % tables.length].id : null,
        confirmedById: timeline.confirmAt ? hosts[index % hosts.length].id : null,
        note: definition.note,
        cancelReason: definition.cancelReason,
        subtotal: money(subtotal),
        vatAmount: money(vatAmount),
        totalAmount: money(totalAmount),
        deliveryInfo: definition.type === OrderType.DELIVERY ? { fullName: customer.name, phone: `09${String(12000000 + index * 173).slice(-8)}`, address: `${18 + index * 3} Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh`, note: index % 2 === 0 ? 'Gọi điện trước khi giao' : 'Giao tại sảnh lễ tân' } : undefined,
        ...timeline,
        paidAt: isPaid ? new Date(createdAt.getTime() + 6 * 60_000) : null,
        expireAt: definition.status === OrderStatus.PENDING_PAYMENT ? new Date(createdAt.getTime() + 15 * 60_000) : null,
        createdAt,
        items: {
          create: items.map(({ item, quantity, subTotal, status }, itemIndex) => ({
            menuItemId: item.id,
            quantity,
            unitPrice: item.basePrice,
            subTotal: money(subTotal),
            status,
            note: itemIndex === 0 && index % 4 === 0 ? 'Không hành, ít cay' : null,
            snapshot: { name: item.name, description: item.description, image: item.image, basePrice: Number(item.basePrice), selectedOptions: [] },
            createdAt
          }))
        },
        payments: {
          create: {
            method: definition.paymentMethod,
            status: definition.paymentStatus,
            amount: money(totalAmount),
            txnRef: definition.paymentMethod === PaymentMethod.CASH ? null : `${definition.paymentMethod}_${createdAt.getTime()}_${suffix}`,
            gatewayData: definition.paymentMethod === PaymentMethod.CASH ? {} : { provider: definition.paymentMethod, responseCode: definition.paymentStatus === PaymentStatus.FAILED ? '99' : '00', bankCode: definition.paymentMethod === PaymentMethod.VNPAY ? 'NCB' : undefined },
            paidAt: isPaid ? new Date(createdAt.getTime() + 6 * 60_000) : null,
            createdAt
          }
        }
      },
      include: { items: true }
    })
    orders.push(order)
  }

  const completedOrders = orders.filter((order) => order.status === OrderStatus.COMPLETED)
  for (const [index, order] of completedOrders.entries()) {
    const menuItemId = order.items[0]?.menuItemId
    if (!menuItemId) continue
    await prisma.review.create({
      data: {
        customerId: order.customerId!,
        menuItemId,
        orderId: order.id,
        rating: 4 + (index % 2),
        comment: index % 2 === 0 ? 'Món ăn ngon, đóng gói cẩn thận và phục vụ nhanh.' : 'Hương vị vừa miệng, nhân viên hỗ trợ rất nhiệt tình.',
        images: []
      }
    })
  }

  await seedMongoData(orders, customers, hosts)
  console.log(`Seed hoàn tất: ${tables.length} bàn, ${orders.length} đơn, ${completedOrders.length} đánh giá.`)
  console.log(`Giữ nguyên ${customers.length + hosts.length} user và ${menuItems.length} món ăn/menu hiện có.`)
}

main().catch((error) => {
  console.error('Seed thất bại:', error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
  await mongoose.disconnect()
})
