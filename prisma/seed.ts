import 'dotenv/config'
import { Prisma } from '../src/generated/prisma/client'
import { prisma } from '../src/config/prisma'
import { hashPassword } from '../src/utils/crypto'

const mockEmail = (name: string) => `mock.${name}@foodhub.local`
const mockOrderCode = (index: number) => `MOCK_${String(index).padStart(3, '0')}`
const money = (value: number) => new Prisma.Decimal(value.toFixed(2))

const categories = [
  { name: 'Khai vị', icon: '🥗', sortOrder: 1 },
  { name: 'Món chính', icon: '🍛', sortOrder: 2 },
  { name: 'Món chay', icon: '🌱', sortOrder: 3 },
  { name: 'Đồ uống', icon: '🥤', sortOrder: 4 },
  { name: 'Tráng miệng', icon: '🍰', sortOrder: 5 },
  { name: 'Combo tiết kiệm', icon: '🎁', sortOrder: 6 }
]

const menuItems = [
  ['Khai vị', 'Gỏi cuốn tôm thịt', 'Tôm, thịt heo, rau sống và bún cuốn bánh tráng.', 55000, true],
  ['Khai vị', 'Khoai tây chiên phô mai', 'Khoai tây chiên giòn phủ sốt phô mai.', 49000, false],
  ['Khai vị', 'Cánh gà sốt mắm tỏi', 'Cánh gà chiên giòn sốt mắm tỏi đậm vị.', 89000, true],
  ['Món chính', 'Cơm tấm sườn nướng', 'Sườn nướng mật ong, bì, chả và trứng ốp la.', 79000, true],
  ['Món chính', 'Bún bò Huế đặc biệt', 'Nước dùng cay thơm, bò viên, chả cua và thịt bò.', 85000, true],
  ['Món chính', 'Mì Quảng gà', 'Mì Quảng truyền thống với gà ta và đậu phộng.', 69000, false],
  ['Món chính', 'Cá hồi áp chảo', 'Cá hồi áp chảo dùng kèm rau củ và sốt bơ chanh.', 159000, true],
  ['Món chính', 'Burger bò phô mai', 'Bò nướng, cheddar, rau xanh và khoai tây chiên.', 99000, true],
  ['Món chay', 'Cơm chay nấm kho', 'Cơm gạo lứt, nấm kho tiêu và rau củ theo mùa.', 65000, true],
  ['Món chay', 'Bún thái chay', 'Bún rau củ với nước dùng chua cay thanh nhẹ.', 59000, false],
  ['Đồ uống', 'Trà đào cam sả', 'Trà đen, đào vàng, cam tươi và sả.', 39000, true],
  ['Đồ uống', 'Cà phê sữa đá', 'Cà phê rang xay pha phin cùng sữa đặc.', 32000, false],
  ['Đồ uống', 'Nước ép dưa hấu', 'Dưa hấu tươi ép trong ngày.', 45000, false],
  ['Đồ uống', 'Matcha latte', 'Matcha Nhật Bản và sữa tươi.', 55000, true],
  ['Tráng miệng', 'Cheesecake chanh dây', 'Bánh phô mai mềm với sốt chanh dây.', 59000, true],
  ['Tráng miệng', 'Chè khúc bạch', 'Khúc bạch hạnh nhân, vải và hạt chia.', 45000, false],
  ['Combo tiết kiệm', 'Combo cơm trưa văn phòng', 'Cơm tấm, canh và trà đào.', 109000, true],
  ['Combo tiết kiệm', 'Combo gia đình 4 người', 'Bốn món chính, khai vị và bốn nước uống.', 399000, true]
] as const

async function clearMockData() {
  await prisma.review.deleteMany({ where: { customer: { email: { startsWith: 'mock.' } } } })
  await prisma.payment.deleteMany({ where: { order: { orderCode: { startsWith: 'MOCK_' } } } })
  await prisma.orderItem.deleteMany({ where: { order: { orderCode: { startsWith: 'MOCK_' } } } })
  await prisma.order.deleteMany({ where: { orderCode: { startsWith: 'MOCK_' } } })
  await prisma.flashSale.deleteMany({ where: { createdBy: { email: { startsWith: 'mock.' } } } })
  await prisma.variantOption.deleteMany({ where: { group: { item: { category: { name: { in: categories.map((category) => category.name) } } } } } })
  await prisma.variantGroup.deleteMany({ where: { item: { category: { name: { in: categories.map((category) => category.name) } } } } })
  await prisma.menuItem.deleteMany({ where: { category: { name: { in: categories.map((category) => category.name) } } } })
  await prisma.menuCategory.deleteMany({ where: { name: { in: categories.map((category) => category.name) } } })
  await prisma.table.deleteMany({ where: { name: { startsWith: 'Mock ' } } })
  await prisma.refreshToken.deleteMany({ where: { user: { email: { startsWith: 'mock.' } } } })
  await prisma.user.deleteMany({ where: { email: { startsWith: 'mock.' } } })
}

async function main() {
  await clearMockData()
  const password = await hashPassword('FoodHub@123')
  const [admin, staff, customerOne, customerTwo, customerThree] = await Promise.all([
    prisma.user.create({ data: { email: mockEmail('admin'), password, name: 'Nguyễn Minh Anh', role: 'ADMIN', isVerified: true, phone: '0901000001' } }),
    prisma.user.create({ data: { email: mockEmail('staff'), password, name: 'Trần Quốc Bảo', role: 'STAFF', isVerified: true, phone: '0901000002' } }),
    prisma.user.create({ data: { email: mockEmail('customer1'), password, name: 'Lê Hoàng Nam', role: 'CUSTOMER', isVerified: true, phone: '0901000003' } }),
    prisma.user.create({ data: { email: mockEmail('customer2'), password, name: 'Phạm Ngọc Mai', role: 'CUSTOMER', isVerified: true, phone: '0901000004' } }),
    prisma.user.create({ data: { email: mockEmail('customer3'), password, name: 'Võ Gia Hân', role: 'CUSTOMER', isVerified: false, phone: '0901000005' } })
  ])

  const createdCategories = Object.fromEntries(await Promise.all(categories.map(async (category) => [
    category.name,
    await prisma.menuCategory.create({ data: category })
  ]))) as Record<string, { id: string }>

  const createdItems: Record<string, { id: string; basePrice: Prisma.Decimal }> = {}
  for (const [index, [category, name, description, price, featured]] of menuItems.entries()) {
    const item = await prisma.menuItem.create({
      data: {
        categoryId: createdCategories[category].id,
        name,
        description,
        basePrice: money(price),
        image: `https://images.unsplash.com/photo-${100000 + index}?auto=format&fit=crop&w=900&q=80`,
        isFeatured: featured,
        isAvailable: name !== 'Mì Quảng gà',
        totalOrder: 8 + index * 7,
        avgRating: money(3.8 + (index % 5) * 0.2),
        sortOrder: index + 1
      }
    })
    createdItems[name] = item
  }

  const variantData = [
    ['Cơm tấm sườn nướng', 'Chọn loại trứng', 'SINGLE', true, ['Trứng ốp la', 'Trứng chiên']],
    ['Cà phê sữa đá', 'Kích cỡ', 'SINGLE', true, ['Vừa', 'Lớn']],
    ['Burger bò phô mai', 'Thêm món', 'MULTIPLE', false, ['Thêm phô mai', 'Thêm trứng', 'Thêm bacon']],
    ['Combo gia đình 4 người', 'Chọn nước uống', 'MULTIPLE', true, ['Trà đào', 'Coca-Cola', 'Nước suối']]
  ] as const
  for (const [itemName, groupName, type, required, options] of variantData) {
    await prisma.variantGroup.create({
      data: {
        itemId: createdItems[itemName].id,
        name: groupName,
        type,
        isRequired: required,
        options: { create: options.map((name, index) => ({ name, priceAdd: money(index * 15000), sortOrder: index })) }
      }
    })
  }

  await prisma.flashSale.createMany({
    data: [
      { itemId: createdItems['Gỏi cuốn tôm thịt'].id, createdById: admin.id, discountPercent: money(15), startsAt: new Date(Date.now() - 86400000), endsAt: new Date(Date.now() + 6 * 86400000), isActive: true },
      { itemId: createdItems['Matcha latte'].id, createdById: admin.id, discountPercent: money(20), startsAt: new Date(Date.now() - 3 * 86400000), endsAt: new Date(Date.now() - 3600000), isActive: false },
      { itemId: createdItems['Combo cơm trưa văn phòng'].id, createdById: admin.id, discountPercent: money(10), startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 4 * 86400000), isActive: true }
    ]
  })

  const tables = await Promise.all([
    ['Mock Bàn 01', 2, 'Tầng 1', true], ['Mock Bàn 02', 2, 'Tầng 1', true], ['Mock Bàn 03', 4, 'Tầng 1', true],
    ['Mock Bàn 04', 4, 'Tầng 1', true], ['Mock Bàn 05', 6, 'Tầng 2', true], ['Mock Bàn 06', 8, 'Tầng 2', true],
    ['Mock Bàn 07', 2, 'Ngoài trời', false], ['Mock Bàn 08', 4, 'Ngoài trời', true]
  ].map(([name, capacity, floor, isActive]) => prisma.table.create({ data: { name, capacity, floor, isActive, note: isActive ? null : 'Đang bảo trì điều hòa' } })))

  const orderSpecs = [
    { type: 'DINE_IN', status: 'PENDING_CONFIRMATION', customerId: customerOne.id, tableId: tables[0].id, method: 'CASH', payment: 'UNPAID' },
    { type: 'DINE_IN', status: 'PREPARING', customerId: customerTwo.id, tableId: tables[1].id, method: 'CASH', payment: 'PAID' },
    { type: 'DINE_IN', status: 'READY', customerId: customerOne.id, tableId: tables[2].id, method: 'VNPAY', payment: 'PAID' },
    { type: 'TAKEAWAY', status: 'COMPLETED', customerId: customerThree.id, method: 'MOMO', payment: 'PAID' },
    { type: 'DELIVERY', status: 'CONFIRMED', customerId: customerTwo.id, method: 'CASH', payment: 'UNPAID' },
    { type: 'DELIVERY', status: 'CANCELLED', customerId: customerThree.id, method: 'VNPAY', payment: 'REFUNDED' },
    { type: 'TAKEAWAY', status: 'PENDING_PAYMENT', customerId: customerOne.id, method: 'VNPAY', payment: 'PENDING' },
    { type: 'DINE_IN', status: 'PAYMENT_FAILED', customerId: null, tableId: tables[3].id, method: 'VNPAY', payment: 'FAILED' }
  ] as const

  const itemNames = ['Cơm tấm sườn nướng', 'Trà đào cam sả', 'Bún bò Huế đặc biệt', 'Cheesecake chanh dây']
  const orders = []
  for (const [index, spec] of orderSpecs.entries()) {
    const createdAt = new Date(Date.now() - (orderSpecs.length - index) * 86400000)
    const selected = itemNames.slice(0, 2 + (index % 3))
    const orderItems = selected.map((itemName, itemIndex) => {
      const item = createdItems[itemName]
      const quantity = (index + itemIndex) % 3 + 1
      return { item, quantity, subtotal: Number(item.basePrice) * quantity }
    })
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
    const vatAmount = subtotal * 0.08
    const order = await prisma.order.create({
      data: {
        orderCode: mockOrderCode(index + 1),
        pickupCode: spec.type === 'TAKEAWAY' ? `P${String(index + 1).padStart(3, '0')}` : null,
        sessionId: `mock-session-${index + 1}`,
        type: spec.type,
        status: spec.status,
        customerId: spec.customerId,
        tableId: 'tableId' in spec ? spec.tableId : null,
        confirmedById: ['CONFIRMED', 'PREPARING', 'READY'].includes(spec.status) ? staff.id : null,
        note: index % 2 === 0 ? 'Dữ liệu mock để kiểm thử luồng đặt món.' : null,
        cancelReason: spec.status === 'CANCELLED' ? 'Khách thay đổi kế hoạch.' : null,
        subtotal: money(subtotal),
        vatAmount: money(vatAmount),
        totalAmount: money(subtotal + vatAmount),
        deliveryInfo: spec.type === 'DELIVERY' ? { fullName: 'Khách mock', phone: '0909000000', address: '12 Nguyễn Huệ, Quận 1, TP.HCM', note: 'Giao giờ hành chính' } : undefined,
        createdAt,
        confirmAt: ['CONFIRMED', 'PREPARING', 'READY'].includes(spec.status) ? new Date(createdAt.getTime() + 180000) : null,
        readyAt: spec.status === 'READY' ? new Date(createdAt.getTime() + 1800000) : null,
        servedAt: spec.status === 'COMPLETED' ? new Date(createdAt.getTime() + 3600000) : null,
        paidAt: ['PAID', 'REFUNDED'].includes(spec.payment) ? new Date(createdAt.getTime() + 300000) : null,
        items: { create: orderItems.map(({ item, quantity, subtotal: itemSubtotal }) => ({ menuItemId: item.id, quantity, unitPrice: item.basePrice, subTotal: money(itemSubtotal), status: spec.status === 'COMPLETED' ? 'SERVED' : spec.status === 'PREPARING' ? 'PREPARING' : 'WAITING', snapshot: { name: item.name, basePrice: Number(item.basePrice) } })) },
        payments: { create: { method: spec.method, status: spec.payment, amount: money(subtotal + vatAmount), txnRef: spec.payment === 'PENDING' ? null : `MOCK_TXN_${index + 1}`, paidAt: ['PAID', 'REFUNDED'].includes(spec.payment) ? new Date(createdAt.getTime() + 300000) : null, gatewayData: { source: 'mock-seed' } } }
      },
      include: { items: true }
    })
    orders.push(order)
  }

  await prisma.review.createMany({
    data: [
      { customerId: customerOne.id, menuItemId: createdItems['Cơm tấm sườn nướng'].id, orderId: orders[2].id, rating: 5, comment: 'Sườn nướng thơm, phần ăn vừa đủ.', images: [] },
      { customerId: customerThree.id, menuItemId: createdItems['Trà đào cam sả'].id, orderId: orders[3].id, rating: 4, comment: 'Vị thanh, giao nhanh.', images: [] },
      { customerId: customerTwo.id, menuItemId: createdItems['Bún bò Huế đặc biệt'].id, orderId: orders[1].id, rating: 4, comment: 'Nước dùng đậm đà.', images: [] }
    ]
  })

  console.log(`Mock seed completed: ${Object.keys(createdItems).length} menu items, ${tables.length} tables, ${orders.length} orders.`)
  console.log('Login accounts: mock.admin@foodhub.local / FoodHub@123')
  console.log('Customer accounts: mock.customer1@foodhub.local, mock.customer2@foodhub.local, mock.customer3@foodhub.local / FoodHub@123')
}

main().catch((error) => {
  console.error('Mock seed failed:', error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
})