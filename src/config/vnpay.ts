import 'dotenv/config'
import { HashAlgorithm, VNPay } from 'vnpay'

const testMode = process.env.VNPAY_TEST_MODE !== 'false'
const vnpayHost = process.env.VNPAY_HOST || (testMode ? 'https://sandbox.vnpayment.vn' : '')

if (!process.env.VNPAY_TMN_CODE || !process.env.VNPAY_HASH_SECRET) {
  throw new Error('VNPAY_TMN_CODE and VNPAY_HASH_SECRET are required')
}

if (!vnpayHost) {
  throw new Error('VNPAY_HOST is required when VNPAY_TEST_MODE=false')
}

export const vnpay = new VNPay({
  tmnCode: process.env.VNPAY_TMN_CODE,
  secureSecret: process.env.VNPAY_HASH_SECRET,
  vnpayHost,
  testMode,
  hashAlgorithm: HashAlgorithm.SHA512,
  enableLog: process.env.NODE_ENV !== 'production',
  endpoints: {
    paymentEndpoint: 'paymentv2/vpcpay.html'
  }
})
