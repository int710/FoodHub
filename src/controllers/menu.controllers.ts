import { Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { MENU_MESSAGE } from '~/constants/message'
import { ApiResponse } from '~/models/ApiResponse'
import { CategoryBody } from '~/models/schemas/menu.schema'
import { menusServices } from '~/services/menu.services'

export const menusController = {
  async getAllCategory(req: Request, res: Response) {
    const result = await menusServices.getAllCategories()
    return res.json(ApiResponse(MENU_MESSAGE.GET_ALL_CATEGORIES_SUCCESS, result))
  },

  async createCategory(req: Request<ParamsDictionary, any, CategoryBody>, res: Response) {
    const result = await menusServices.createCategory(req.body)
    return res.json(ApiResponse(MENU_MESSAGE.CREATE_CATEGORY_SUCCESS, result))
  },

  async updateCategory(req: Request<{ id: string }, any, CategoryBody>, res: Response) {
    const result = await menusServices.updateCategory(req.params.id, req.body)
    return res.json(ApiResponse(MENU_MESSAGE.UPDATE_MENU_SUCCESS, result))
  },

  async deleteCategory(req: Request<{ id: string }>, res: Response) {
    await menusServices.deleteCategory(req.params.id)
    return res.json(ApiResponse(MENU_MESSAGE.DELETE_CAT_SUCCESS, null))
  }
}
