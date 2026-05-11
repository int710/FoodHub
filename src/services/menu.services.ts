import id from 'zod/v4/locales/id.js'
import { prisma } from '~/config/prisma'
import HTTP_STATUS from '~/constants/httpStatus'
import { MENU_MESSAGE } from '~/constants/message'
import { ErrorWithStatus } from '~/models/Errors'
import {
  CategoryBody,
  CreateMenuItemRequest,
  GetAllItemsQueryType,
  UpdateMenuItemRequestBody,
  UpdateVariantGroupInput,
  VariantGroupRequestType
} from '~/models/schemas/menu.schema'

class MenuServices {
  async getAllCategories() {
    return prisma.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { item: true } } }
    })
  }

  async createCategory(data: CategoryBody) {
    const category = await prisma.menuCategory.create({
      data
    })
    return category
  }

  async updateCategory(id: string, data: CategoryBody) {
    const category = await prisma.menuCategory.findUnique({ where: { id } })
    if (!category) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.NOT_FOUND, // 404
        message: MENU_MESSAGE.MENU_NOT_FOUND
      })
    }
    return prisma.menuCategory.update({
      where: { id },
      data
    })
  }

  async deleteCategory(id: string) {
    const category = await prisma.menuCategory.findUnique({ where: { id } })
    if (!category) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: MENU_MESSAGE.MENU_NOT_FOUND })
    }
    // Check xem danh mục này có item nào không
    const countItems = await prisma.menuItem.count({ where: { categoryId: id } })
    if (countItems > 0) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: `Không thể xóa danh mục này, bạn có ${countItems} món ăn cần di chuyển hoặc xóa chúng trước`
      })
    }

    await prisma.menuCategory.delete({ where: { id } })
  }

  async createMenuItem(data: CreateMenuItemRequest) {
    const { categoryId } = data
    const categoryExists = await prisma.menuCategory.findUnique({ where: { id: categoryId } })
    if (!categoryExists) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message: MENU_MESSAGE.CATEGORY_IS_INVALID })
    }
    const item = await prisma.menuItem.create({ data: data })
    return item
  }

  async updateMenuItem(id: string, data: UpdateMenuItemRequestBody) {
    const item = await prisma.menuItem.findUnique({ where: { id } })
    if (!item) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: MENU_MESSAGE.ITEM_IS_INVALID })
    }
    const itemUpdate = await prisma.menuItem.update({ where: { id }, data })
    return itemUpdate
  }

  async getAllItems(filters: GetAllItemsQueryType) {
    const { limit, page, categoryId, isAvailable } = filters
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where: { ...(categoryId && { categoryId }), ...(isAvailable !== undefined && { isAvailable }) },
        include: {
          category: { select: { id: true, name: true } },
          variantGroups: { include: { options: true } },
          flashSale: true,
          _count: { select: { reviews: true } }
        },
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
        skip,
        take: limit
      }),
      prisma.menuItem.count({
        where: {
          ...(categoryId && { categoryId }),
          ...(isAvailable !== undefined && { isAvailable })
        }
      })
    ])

    return {
      data: items,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    }
  }

  async toggleItem(id: string) {
    const item = await prisma.menuItem.findUnique({ where: { id } })
    if (!item) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: MENU_MESSAGE.ITEM_NOT_FOUND })
    }
    const itemAvailable = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !item.isAvailable },
      select: { id: true, name: true, isAvailable: true }
    })
    return itemAvailable
  }

  async deleteItem(id: string) {
    const activeOrderCount = await prisma.orderItem.count({
      where: { menuItemId: id, order: { status: { in: ['CONFIRMED', 'PENDING', 'PREPARING', 'READY', 'SERVED'] } } }
    })

    if (activeOrderCount > 0) {
      await prisma.menuItem.update({ where: { id }, data: { isAvailable: false } })
      return {
        deleted: false,
        hidden: true,
        message: 'Không xóa ngay lập tức. Sản phầm tạm thời sẽ bị ẩn đi vì xuất hiện trong order của khách hàng'
      }
    }

    await prisma.menuItem.delete({ where: { id } })
    return { deleted: true, hidden: false, message: 'Đã xóa món ăn' }
  }

  async createVariant(itemId: string, dto: VariantGroupRequestType) {
    const item = await prisma.menuItem.findUnique({ where: { id: itemId } })
    if (!item) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message: MENU_MESSAGE.ITEM_IS_INVALID })
    }

    const group = await prisma.variantGroup.create({
      data: {
        itemId,
        name: dto.name,
        type: dto.type,
        isRequired: dto.isRequired,
        sortOrder: dto.sortOrder,
        options: {
          create: dto.options.map((o, i) => ({
            name: o.name,
            priceAdd: o.priceAdd,
            sortOrder: o.sortOrder ?? i
          }))
        }
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } }
    })

    return group
  }

  async updateVariantGroup(groupVariantId: string, dto: UpdateVariantGroupInput) {
    const group = await prisma.variantGroup.findUnique({ where: { id: groupVariantId } })
    if (!group) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: MENU_MESSAGE.VARIANT_GROUP_NOT_EXISTS
      })
    }

    const updated = await prisma.variantGroup.update({
      where: { id: groupVariantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.options && {
          options: {
            // update option đã có id tồn tại
            upsert: dto.options
              .filter((o) => o.id)
              .map((o, i) => ({
                where: { id: o.id! },
                update: {
                  name: o.name,
                  priceAdd: o.priceAdd,
                  sortOrder: o.sortOrder ?? i
                },
                create: {
                  name: o.name,
                  priceAdd: o.priceAdd,
                  sortOrder: o.sortOrder ?? i
                }
              })),
            create: dto.options
              .filter((o) => !o.id)
              .map((o) => ({
                name: o.name!,
                priceAdd: o.priceAdd ?? 0,
                sortOrder: o.sortOrder ?? 0,
                isActive: true
              }))
          }
        })
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } }
    })
    return updated
  }
}

export const menusServices = new MenuServices()
