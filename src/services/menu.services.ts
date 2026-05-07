import { prisma } from '~/config/prisma'
import HTTP_STATUS from '~/constants/httpStatus'
import { MENU_MESSAGE } from '~/constants/message'
import { ErrorWithStatus } from '~/models/Errors'
import { CategoryBody } from '~/models/schemas/menu.schema'

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
}

export const menusServices = new MenuServices()
