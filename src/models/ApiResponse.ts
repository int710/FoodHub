export const ApiResponse = <T>(
  message = 'Ok',
  data: T,
  pagination?: { page: number; limit: number; total: number }
) => ({ success: true, message, data, ...(pagination && { pagination }) })
