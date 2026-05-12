import { Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { MENU_MESSAGE } from '~/constants/message'
import { ApiResponse } from '~/models/ApiResponse'
import {
  CategoryBody,
  CreateFlashSalesType,
  CreateMenuItemRequest,
  getItemsQuery,
  UpdateMenuItemRequestBody
} from '~/models/schemas/menu.schema'
import { menusServices } from '~/services/menu.services'

export const menusController = {
  async getPublicAll(req: Request, res: Response) {
    const data = await menusServices.getAll()
    return res.json(ApiResponse(MENU_MESSAGE.GET_ALL_SUCCESS, data))
  },

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
  },

  async createMenuItem(req: Request<ParamsDictionary, any, CreateMenuItemRequest>, res: Response) {
    const result = await menusServices.createMenuItem(req.body)
    return res.json(ApiResponse(MENU_MESSAGE.CREATE_MENU_ITEM_SUCCESS, result))
  },

  async updateMenuItem(req: Request<{ id: string }, any, UpdateMenuItemRequestBody>, res: Response) {
    const result = await menusServices.updateMenuItem(req.params.id, req.body)
    return res.json(ApiResponse(MENU_MESSAGE.UPDATE_ITEM_SUCCESS, result))
  },

  async getAllItems(req: Request, res: Response) {
    const { query } = getItemsQuery.parse({ query: req.query })
    const result = await menusServices.getAllItems(query)
    return res.json(ApiResponse(MENU_MESSAGE.GET_ALL_ITEMS_SUCCESS, result))
  },

  async toggleItem(req: Request<{ id: string }>, res: Response) {
    const result = await menusServices.toggleItem(req.params.id)
    const msg = result.isAvailable ? 'Sản phẩm đang hoạt động' : 'Sản phẩm đang được tạm dừng'
    return res.json(ApiResponse(msg, result))
  },

  async deleteItem(req: Request<{ id: string }>, res: Response) {
    const data = await menusServices.deleteItem(req.params.id)
    return res.json(ApiResponse(MENU_MESSAGE.DELETE_ITEM_SUCCESS, data))
  },

  async createVariant(req: Request<{ idItem: string }>, res: Response) {
    const data = await menusServices.createVariant(req.params.idItem, req.body)
    return res.json(ApiResponse(MENU_MESSAGE.CREATE_VARIANT_SUCCESS, data))
  },

  async updateVariantItem(req: Request<{ groupVariantId: string }>, res: Response) {
    const data = await menusServices.updateVariantGroup(req.params.groupVariantId, req.body)
    return res.json(ApiResponse(MENU_MESSAGE.CREATE_VARIANT_SUCCESS, data))
  },

  async createFlashSale(req: Request<ParamsDictionary, any, CreateFlashSalesType>, res: Response) {
    const data = await menusServices.createFlashSales(req.decoded_authorization?.user_id as string, req.body)
    return res.json(ApiResponse(MENU_MESSAGE.CREATE_FLASHSALES_SUCCESS, data))
  },

  async deleteFlashSale(req: Request<{ itemId: string }>, res: Response) {
    await menusServices.deleteFlashSale(req.params.itemId)
    return res.json(ApiResponse(MENU_MESSAGE.DELETE_FLASHSALE_SUCCESS, null))
  },

  async getItemDetail(req: Request<{ id: string }>, res: Response) {
    const data = await menusServices.getItemDetail(req.params.id)
    return res.json(ApiResponse(MENU_MESSAGE.GET_ALL_SUCCESS, data))
  }
}
