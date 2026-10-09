import 'dotenv/config'

const SANDBOX_CREATE_URL = 'https://sb-openapi.zalopay.vn/v2/create'
const SANDBOX_QUERY_URL = 'https://sb-openapi.zalopay.vn/v2/query'

// Bộ thông tin dùng thử do ZaloPay công khai trong tài liệu v2/start. Chỉ được
// dùng ở sandbox; production bắt buộc cấu hình bộ khóa merchant riêng.
const TRIAL_SANDBOX = {
  appId: '2554',
  key1: 'sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn',
  key2: 'trMrHtvjo6myautxDUiAcYsVtaeQ8nhf'
}

const testMode = process.env.ZALOPAY_TEST_MODE !== 'false'
const appId = process.env.ZALOPAY_APP_ID?.trim() || (testMode ? TRIAL_SANDBOX.appId : '')
const key1 = process.env.ZALOPAY_KEY1?.trim() || (testMode ? TRIAL_SANDBOX.key1 : '')
const key2 = process.env.ZALOPAY_KEY2?.trim() || (testMode ? TRIAL_SANDBOX.key2 : '')
const createUrl = process.env.ZALOPAY_CREATE_URL?.trim() || (testMode ? SANDBOX_CREATE_URL : '')
const queryUrl = process.env.ZALOPAY_QUERY_URL?.trim() || (testMode ? SANDBOX_QUERY_URL : '')

if (!appId || !key1 || !key2 || !createUrl || !queryUrl) {
  throw new Error('ZALOPAY_APP_ID, ZALOPAY_KEY1, ZALOPAY_KEY2, ZALOPAY_CREATE_URL and ZALOPAY_QUERY_URL are required')
}

if (!/^\d+$/.test(appId)) throw new Error('ZALOPAY_APP_ID must be numeric')
if (!testMode && appId === TRIAL_SANDBOX.appId) {
  throw new Error('ZaloPay trial credentials cannot be used in production mode')
}
if (testMode && (createUrl !== SANDBOX_CREATE_URL || queryUrl !== SANDBOX_QUERY_URL)) {
  throw new Error('ZaloPay sandbox mode must use the official sandbox endpoints')
}

export const zalopayConfig = {
  appId,
  key1,
  key2,
  createUrl,
  queryUrl,
  testMode
} as const
