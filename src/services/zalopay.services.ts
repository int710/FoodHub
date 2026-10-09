import { createHmac, timingSafeEqual } from 'crypto'
import { zalopayConfig } from '~/config/zalopay'

export const ZALOPAY_PAYMENT_TIMEOUT_MS = 15 * 60 * 1000

type ZaloPayCreateInput = {
  orderCode: string
  amount: number
  appUser: string
  items?: unknown[]
  appTransId?: string
}

export type ZaloPayCreateResult = {
  appTransId: string
  orderUrl: string
  qrCode: string | null
  zpTransToken: string | null
  orderToken: string | null
  raw: Record<string, unknown>
}

export type ZaloPayQueryResult = {
  returnCode: number
  isPaid: boolean
  isProcessing: boolean
  raw: Record<string, unknown>
}

export type ZaloPayCallbackData = {
  app_id: number
  app_trans_id: string
  amount: number
  zp_trans_id?: number
  server_time?: number
  channel?: number
  merchant_user_id?: string
  user_fee_amount?: number
  discount_amount?: number
}

function hmacSha256(data: string, key: string) {
  return createHmac('sha256', key).update(data, 'utf8').digest('hex')
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left.toLowerCase(), 'utf8')
  const b = Buffer.from(right.toLowerCase(), 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

function vietnamDatePrefix(date = new Date()) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).map((part) => [part.type, part.value])
  )
  return `${values.year}${values.month}${values.day}`
}

export function createZaloPayTransactionId(orderCode: string, date = new Date()) {
  const suffix = orderCode.replace(/[^A-Za-z0-9]/g, '').slice(-30)
  return `${vietnamDatePrefix(date)}_${suffix}`.slice(0, 40)
}

async function postForm(url: string, values: Record<string, string>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
    signal: AbortSignal.timeout(15_000)
  })
  const text = await response.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`ZaloPay trả dữ liệu không hợp lệ (HTTP ${response.status})`)
  }
  if (!response.ok) throw new Error(`ZaloPay HTTP ${response.status}: ${String(data.return_message || '')}`)
  return data
}

export async function createZaloPayOrder(input: ZaloPayCreateInput): Promise<ZaloPayCreateResult> {
  const callbackUrl = process.env.ZALOPAY_CALLBACK_URL?.trim()
  const redirectUrl = process.env.ZALOPAY_REDIRECT_URL?.trim()
  if (!callbackUrl || !redirectUrl) throw new Error('ZALOPAY_CALLBACK_URL and ZALOPAY_REDIRECT_URL are required')

  const appTransId = input.appTransId || createZaloPayTransactionId(input.orderCode)
  const appTime = Date.now()
  const amount = Math.round(input.amount)
  const embedData = JSON.stringify({
    redirecturl: redirectUrl,
    preferred_payment_method: ['vietqr'],
    merchantinfo: input.orderCode
  })
  const item = JSON.stringify(input.items || [])
  const macData = [
    zalopayConfig.appId,
    appTransId,
    input.appUser,
    String(amount),
    String(appTime),
    embedData,
    item
  ].join('|')

  const raw = await postForm(zalopayConfig.createUrl, {
    app_id: zalopayConfig.appId,
    app_user: input.appUser,
    app_time: String(appTime),
    amount: String(amount),
    app_trans_id: appTransId,
    embed_data: embedData,
    item,
    bank_code: '',
    description: `FoodHub - Thanh toan don ${input.orderCode}`,
    callback_url: callbackUrl,
    mac: hmacSha256(macData, zalopayConfig.key1)
  })

  if (Number(raw.return_code) !== 1 || typeof raw.order_url !== 'string' || !raw.order_url) {
    throw new Error(`ZaloPay từ chối tạo giao dịch: ${String(raw.sub_return_message || raw.return_message || 'Unknown error')}`)
  }

  return {
    appTransId,
    orderUrl: raw.order_url,
    qrCode: typeof raw.qr_code === 'string' ? raw.qr_code : null,
    zpTransToken: typeof raw.zp_trans_token === 'string' ? raw.zp_trans_token : null,
    orderToken: typeof raw.order_token === 'string' ? raw.order_token : null,
    raw
  }
}

export async function queryZaloPayOrder(appTransId: string): Promise<ZaloPayQueryResult> {
  const macData = `${zalopayConfig.appId}|${appTransId}|${zalopayConfig.key1}`
  const raw = await postForm(zalopayConfig.queryUrl, {
    app_id: zalopayConfig.appId,
    app_trans_id: appTransId,
    mac: hmacSha256(macData, zalopayConfig.key1)
  })
  const returnCode = Number(raw.return_code)
  return { returnCode, isPaid: returnCode === 1, isProcessing: returnCode === 3, raw }
}

export function verifyZaloPayCallback(data: string, requestMac: string) {
  const expectedMac = hmacSha256(data, zalopayConfig.key2)
  if (!safeEqual(expectedMac, requestMac)) return null
  const parsed = JSON.parse(data) as ZaloPayCallbackData
  if (String(parsed.app_id) !== zalopayConfig.appId || !parsed.app_trans_id) return null
  return parsed
}

export function verifyZaloPayRedirect(query: Record<string, unknown>) {
  const fields = ['appid', 'apptransid', 'pmcid', 'bankcode', 'amount', 'discountamount', 'status'] as const
  if (fields.some((field) => query[field] === undefined) || typeof query.checksum !== 'string') return false
  const data = fields.map((field) => String(query[field])).join('|')
  return safeEqual(hmacSha256(data, zalopayConfig.key2), query.checksum)
}
