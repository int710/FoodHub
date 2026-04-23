export const ApiResponse = <T>(
  message = 'Ok',
  data: T,
  pagination?: { page: number; limit: number; total: number }
) => ({ message, data, ...(pagination && { pagination }) })
