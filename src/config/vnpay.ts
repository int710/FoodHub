import 'dotenv/config'
import { HashAlgorithm, VNPay } from 'vnpay'

const VNPAY_SANDBOX_PAYMENT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
const testMode = process.env.VNPAY_TEST_MODE !== 'false'
const tmnCode = process.env.VNPAY_TMN_CODE?.trim()
const secureSecret = process.env.VNPAY_HASH_SECRET?.trim()
const configuredPaymentUrl = process.env.VNPAY_URL?.trim() ||
  (testMode ? VNPAY_SANDBOX_PAYMENT_URL : '')

if (!tmnCode || !secureSecret) {
  throw new Error('VNPAY_TMN_CODE and VNPAY_HASH_SECRET are required')
}

if (!/^[A-Za-z0-9]{8}$/.test(tmnCode)) {
  throw new Error('VNPAY_TMN_CODE must contain exactly 8 alphanumeric characters')
}

if (!configuredPaymentUrl) {
  throw new Error('VNPAY_URL is required when VNPAY_TEST_MODE=false')
}

if (testMode && configuredPaymentUrl !== VNPAY_SANDBOX_PAYMENT_URL) {
  throw new Error(`VNPAY_URL must be ${VNPAY_SANDBOX_PAYMENT_URL} in sandbox mode`)
}

const paymentUrl = new URL(configuredPaymentUrl)

export const vnpay = new VNPay({
  tmnCode,
  secureSecret,
  vnpayHost: paymentUrl.origin,
  vnp_Version: '2.1.0',
  testMode,
  hashAlgorithm: HashAlgorithm.SHA512,
  enableLog: process.env.NODE_ENV !== 'production',
  endpoints: {
    paymentEndpoint: paymentUrl.pathname.replace(/^\//, '')
  }
})
