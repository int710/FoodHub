import { HashAlgorithm, VNPay } from "vnpay";

export const vnpay = new VNPay({
  tmnCode: process.env.VNPAY_TMN_CODE!,
  secureSecret: process.env.VNPAY_HASH_SECRET!,
  vnpayHost: 'https://sandbox.vnpayment.vn',
  testMode: true, // true = sandbox, false = production
  hashAlgorithm: HashAlgorithm.SHA512,
  enableLog: process.env.NODE_ENV !== 'production',
  endpoints: {
    paymentEndpoint: 'paymentv2/vpcpay.html'
  }
})