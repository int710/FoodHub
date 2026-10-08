import { Request } from 'express'
import { ProductCode, VnpLocale } from 'vnpay/enums'
import { vnpay } from '~/config/vnpay'

const PAYMENT_TIMEOUT_MINUTES = 15
export const VNPAY_PAYMENT_TIMEOUT_MS = PAYMENT_TIMEOUT_MINUTES * 60 * 1000
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const formatVnpayDate = (date: Date): number => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return Number(`${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`)
}

export const getClientIp = (req: Request): string => {
  let ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1'

  ip = ip.replace(/^::ffff:/, '')
  if (ip === '::1' || ip.includes(':')) ip = '127.0.0.1'

  return ip
}

export const buildVnpayPaymentUrl = ({
  amount,
  orderCode,
  clientIp
}: {
  amount: number
  orderCode: string
  clientIp: string
}) => {
  const returnUrl = process.env.VNPAY_RETURN_URL?.trim()
  if (!returnUrl) {
    throw new Error('VNPAY_RETURN_URL is required')
  }

  const parsedReturnUrl = new URL(returnUrl)
  if (parsedReturnUrl.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('VNPAY_RETURN_URL must use HTTPS in production')
  }

  // Format explicitly in Vietnam time so local and Render (UTC) behave identically.
  const createDate = new Date()
  const expireDate = new Date(createDate.getTime() + VNPAY_PAYMENT_TIMEOUT_MS)

  return vnpay.buildPaymentUrl({
    // vnpay@2.x multiplies the supplied VND amount by 100 internally.
    vnp_Amount: amount,
    vnp_IpAddr: clientIp,
    vnp_TxnRef: orderCode,
    vnp_OrderInfo: `Thanh toan FoodHub ${orderCode}`,
    vnp_OrderType: ProductCode.Other,
    vnp_ReturnUrl: returnUrl,
    vnp_Locale: VnpLocale.VN,
    vnp_CreateDate: formatVnpayDate(createDate),
    vnp_ExpireDate: formatVnpayDate(expireDate)
  })
}
