import { Request, Response } from 'express'
import { OrderType } from '~/generated/prisma/enums'
import { ApiResponse } from '~/models/ApiResponse'
import { CreateVoucherDto, UpdateVoucherDto } from '~/models/schemas/voucher.schema'
import voucherServices from '~/services/vouchers.services'

export const voucherController = {
  async listAdmin(_req: Request, res: Response) {
    return res.json(ApiResponse('Danh sách voucher', await voucherServices.listAdmin()))
  },
  async listAvailable(req: Request, res: Response) {
    const raw = typeof req.query.orderType === 'string' ? req.query.orderType.toUpperCase() : ''
    const orderType = Object.values(OrderType).includes(raw as OrderType) ? raw as OrderType : undefined
    return res.json(ApiResponse('Voucher đang khả dụng', await voucherServices.listAvailable(orderType)))
  },
  async listMine(req: Request, res: Response) {
    const raw = typeof req.query.orderType === 'string' ? req.query.orderType.toUpperCase() : ''
    const orderType = Object.values(OrderType).includes(raw as OrderType) ? raw as OrderType : undefined
    const customerId = req.decoded_authorization?.user_id as string
    return res.json(ApiResponse('Voucher trong tài khoản', await voucherServices.listMine(customerId, orderType)))
  },
  async create(req: Request<any, any, CreateVoucherDto>, res: Response) {
    return res.status(201).json(ApiResponse('Tạo voucher thành công', await voucherServices.create(req.body)))
  },
  async update(req: Request<{ id: string }, any, UpdateVoucherDto>, res: Response) {
    return res.json(ApiResponse('Cập nhật voucher thành công', await voucherServices.update(req.params.id, req.body)))
  },
  async delete(req: Request<{ id: string }>, res: Response) {
    await voucherServices.delete(req.params.id)
    return res.json(ApiResponse('Đã xóa voucher', null))
  }
}
