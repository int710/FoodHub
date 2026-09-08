import type { NextFunction, Request, Response } from 'express'
import swaggerUi from 'swagger-ui-express'
import type { OpenAPIV3 } from 'openapi-types'

const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`

const successResponse = (description = 'Successful response'): OpenAPIV3.ResponseObject => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ApiResponse' }
    }
  }
})

const errorResponse = (description: string): OpenAPIV3.ResponseObject => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' }
    }
  }
})

const bearer: OpenAPIV3.SecurityRequirementObject = { BearerAuth: [] }
const tableToken: OpenAPIV3.SecurityRequirementObject = { TableTokenAuth: [] }
const bearerOrTableToken: OpenAPIV3.SecurityRequirementObject[] = [{ BearerAuth: [] }, { TableTokenAuth: [] }]

const idParameter = (name: string, description: string, format: 'cuid' | 'uuid' | 'string' = 'cuid'): OpenAPIV3.ParameterObject => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', ...(format === 'uuid' ? { format: 'uuid' } : {}) }
})

const jsonBody = (schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, required = true): OpenAPIV3.RequestBodyObject => ({
  required,
  content: { 'application/json': { schema } }
})

const paginatedQuery = (maxLimit = 100): OpenAPIV3.ParameterObject[] => [
  {
    name: 'page',
    in: 'query',
    description: 'Page number, bắt đầu từ 1.',
    schema: { type: 'integer', minimum: 1, default: 1 }
  },
  {
    name: 'limit',
    in: 'query',
    description: `Số bản ghi mỗi trang, tối đa ${maxLimit}.`,
    schema: { type: 'integer', minimum: 1, maximum: maxLimit, default: 20 }
  }
]

const operation = (
  summary: string,
  tags: string[],
  responses: Record<string, OpenAPIV3.ResponseObject>,
  security?: OpenAPIV3.SecurityRequirementObject[] | OpenAPIV3.SecurityRequirementObject
): OpenAPIV3.OperationObject => ({
  summary,
  tags,
  responses,
  ...(security ? { security: Array.isArray(security) ? security : [security] } : {})
})

export const openApiDocument: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'FoodHub API',
    version: process.env.API_VERSION || '1.0.0',
    description: [
      'REST API cho đặt món, quản lý bàn, menu, thanh toán, chat và notification của FoodHub.',
      '',
      'Authentication:',
      '- User login: gửi `Authorization: Bearer <access_token>`.',
      '- Dine-in guest: gửi `X-Table-Token: <table_token>` cho API bàn/cart và dùng `tableToken` khi kết nối Socket.IO.',
      '',
      'Base URL có thể đổi bằng biến môi trường `API_BASE_URL`.'
    ].join('\n'),
    contact: { name: 'FoodHub Engineering' },
    license: { name: 'ISC' }
  },
  servers: [{ url: `${apiBaseUrl}/api/v1`, description: process.env.NODE_ENV === 'production' ? 'Production' : 'Local' }],
  tags: [
    { name: 'Users', description: 'Registration, authentication and account recovery.' },
    { name: 'Tables', description: 'Table management and QR table sessions.' },
    { name: 'Menu', description: 'Public menu and admin menu management.' },
    { name: 'Cart', description: 'Redis-backed cart operations.' },
    { name: 'Orders', description: 'Order creation and kitchen workflow.' },
    { name: 'Payments', description: 'VNPay and cash payment operations.' },
    { name: 'Reviews', description: 'Menu item reviews.' },
    { name: 'Media', description: 'Image upload.' },
    { name: 'Notifications', description: 'Persistent notifications for authenticated users.' }
  ],
  paths: {
    '/user/register': {
      post: {
        ...operation('Register a user', ['Users'], { '200': successResponse('Registration succeeded'), '409': errorResponse('Email already exists'), '422': errorResponse('Validation error') }),
        requestBody: jsonBody({ $ref: '#/components/schemas/RegisterRequest' })
      }
    },
    '/user/login': {
      post: {
        ...operation('Login', ['Users'], { '200': successResponse('Login succeeded'), '401': errorResponse('Invalid credentials'), '422': errorResponse('Validation error') }),
        requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' })
      }
    },
    '/user/logout': {
      post: {
        ...operation('Revoke a refresh token', ['Users'], { '200': successResponse('Logout succeeded'), '422': errorResponse('Validation error') }),
        requestBody: jsonBody({ $ref: '#/components/schemas/RefreshTokenRequest' })
      }
    },
    '/user/refresh-token': {
      post: {
        ...operation('Refresh access and refresh tokens', ['Users'], { '200': successResponse('Tokens refreshed'), '401': errorResponse('Invalid refresh token') }),
        requestBody: jsonBody({ $ref: '#/components/schemas/RefreshTokenRequest' })
      }
    },
    '/user/me': {
      get: operation('Get current user profile', ['Users'], { '200': successResponse(), '401': errorResponse('Authentication required') }, bearer)
    },
    '/user/verify-email': {
      post: {
        ...operation('Verify email address', ['Users'], { '200': successResponse(), '400': errorResponse('Invalid verification token') }),
        requestBody: jsonBody({ $ref: '#/components/schemas/VerifyEmailRequest' })
      }
    },
    '/user/forgot-password': {
      post: {
        ...operation('Request password reset email', ['Users'], { '200': successResponse(), '422': errorResponse('Validation error') }),
        requestBody: jsonBody({ $ref: '#/components/schemas/EmailRequest' })
      }
    },
    '/user/reset-password': {
      post: {
        ...operation('Reset password', ['Users'], { '200': successResponse(), '400': errorResponse('Invalid reset token') }),
        requestBody: jsonBody({ $ref: '#/components/schemas/ResetPasswordRequest' })
      }
    },
    '/table/{id}': {
      get: {
        ...operation('Get table detail', ['Tables'], { '200': successResponse(), '404': errorResponse('Table not found') }),
        parameters: [idParameter('id', 'Table ID')]
      }
    },
    '/table/new': {
      post: {
        ...operation('Create a table', ['Tables'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required'), '409': errorResponse('Table name already exists') }, bearer),
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateTableRequest' })
      }
    },
    '/table/{id}/qr': {
      get: {
        ...operation('Generate QR content for a table', ['Tables'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required'), '404': errorResponse('Table not found') }, bearer),
        parameters: [idParameter('id', 'Table ID')]
      }
    },
    '/table/{id}/regenerate-qr': {
      post: {
        ...operation('Regenerate a table QR token', ['Tables'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required') }, bearer),
        parameters: [idParameter('id', 'Table ID')]
      }
    },
    '/table/{id}/toggle': {
      patch: {
        ...operation('Toggle table availability', ['Tables'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required') }, bearer),
        parameters: [idParameter('id', 'Table ID')]
      }
    },
    '/table/scan': {
      post: {
        ...operation('Scan a table QR token and create a guest session', ['Tables'], { '200': successResponse('Table session created or table is occupied'), '404': errorResponse('Invalid QR code'), '422': errorResponse('Validation error') }),
        requestBody: jsonBody({ $ref: '#/components/schemas/ScanTableRequest' })
      }
    },
    '/menu/all': { get: operation('Get public menu', ['Menu'], { '200': successResponse() }) },
    '/menu/item/{id}': {
      get: {
        ...operation('Get public menu item detail', ['Menu'], { '200': successResponse(), '404': errorResponse('Menu item not found') }),
        parameters: [idParameter('id', 'Menu item ID')]
      }
    },
    '/menu/categories': {
      get: operation('List menu categories', ['Menu'], { '200': successResponse() }),
      post: {
        ...operation('Create menu category', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required'), '422': errorResponse('Validation error') }, bearer),
        requestBody: jsonBody({ $ref: '#/components/schemas/CategoryRequest' })
      }
    },
    '/menu/categories/{id}': {
      put: {
        ...operation('Update menu category', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required'), '404': errorResponse('Category not found') }, bearer),
        parameters: [idParameter('id', 'Category ID')],
        requestBody: jsonBody({ $ref: '#/components/schemas/CategoryRequest' })
      },
      delete: {
        ...operation('Delete menu category', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required'), '404': errorResponse('Category not found') }, bearer),
        parameters: [idParameter('id', 'Category ID')]
      }
    },
    '/menu/items': {
      get: {
        ...operation('List menu items for staff/admin', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Staff or admin role required'), '422': errorResponse('Validation error') }, bearer),
        parameters: [
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'isAvailable', in: 'query', schema: { type: 'boolean' } },
          ...paginatedQuery()
        ]
      },
      post: {
        ...operation('Create menu item', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required'), '422': errorResponse('Validation error') }, bearer),
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateMenuItemRequest' })
      }
    },
    '/menu/items/{id}': {
      patch: {
        ...operation('Update menu item', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required'), '404': errorResponse('Menu item not found') }, bearer),
        parameters: [idParameter('id', 'Menu item ID')],
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateMenuItemRequest' })
      },
      delete: {
        ...operation('Delete or hide menu item', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required') }, bearer),
        parameters: [idParameter('id', 'Menu item ID')]
      }
    },
    '/menu/items/{id}/toggle': {
      patch: {
        ...operation('Toggle menu item availability', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Staff or admin role required') }, bearer),
        parameters: [idParameter('id', 'Menu item ID')]
      }
    },
    '/menu/items/{idItem}/variants': {
      post: {
        ...operation('Create a variant group', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required'), '422': errorResponse('Validation error') }, bearer),
        parameters: [idParameter('idItem', 'Menu item ID')],
        requestBody: jsonBody({ $ref: '#/components/schemas/VariantGroupRequest' })
      }
    },
    '/menu/item-variants/{groupVariantId}': {
      patch: {
        ...operation('Update a variant group', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required') }, bearer),
        parameters: [idParameter('groupVariantId', 'Variant group ID')],
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateVariantGroupRequest' })
      }
    },
    '/menu/item/flash-sales': {
      post: {
        ...operation('Create a flash sale', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required'), '422': errorResponse('Validation error') }, bearer),
        requestBody: jsonBody({ $ref: '#/components/schemas/FlashSaleRequest' })
      }
    },
    '/menu/item/flash-sales/{itemId}': {
      delete: {
        ...operation('Delete a flash sale', ['Menu'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Admin role required') }, bearer),
        parameters: [idParameter('itemId', 'Menu item ID')]
      }
    },
    '/cart/{type}/items': {
      get: {
        ...operation('Get cart', ['Cart'], { '200': successResponse(), '400': errorResponse('Invalid cart type'), '401': errorResponse('Required authentication is missing') }, bearerOrTableToken),
        parameters: [{ $ref: '#/components/parameters/CartType' }]
      }
    },
    '/cart/{type}/items/add': {
      post: {
        ...operation('Add an item to cart', ['Cart'], { '200': successResponse(), '400': errorResponse('Invalid cart context'), '404': errorResponse('Menu item not found'), '422': errorResponse('Validation error') }, bearerOrTableToken),
        parameters: [{ $ref: '#/components/parameters/CartType' }],
        requestBody: jsonBody({ $ref: '#/components/schemas/CartItemRequest' })
      }
    },
    '/cart/{type}/items/{itemId}': {
      patch: {
        ...operation('Update a cart item', ['Cart'], { '200': successResponse(), '400': errorResponse('Invalid cart context'), '404': errorResponse('Cart item not found'), '422': errorResponse('Validation error') }, bearerOrTableToken),
        parameters: [{ $ref: '#/components/parameters/CartType' }, idParameter('itemId', 'Cart item ID')],
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateCartItemRequest' })
      },
      delete: {
        ...operation('Remove a cart item', ['Cart'], { '200': successResponse(), '400': errorResponse('Invalid cart context'), '404': errorResponse('Cart item not found') }, bearerOrTableToken),
        parameters: [{ $ref: '#/components/parameters/CartType' }, idParameter('itemId', 'Cart item ID')]
      }
    },
    '/cart/{type}/clear': {
      delete: {
        ...operation('Clear cart', ['Cart'], { '200': successResponse(), '400': errorResponse('Invalid cart context') }, bearerOrTableToken),
        parameters: [{ $ref: '#/components/parameters/CartType' }]
      }
    },
    '/order/{type}/new': {
      post: {
        ...operation('Create an order', ['Orders'], { '200': successResponse('Order created; VNPay responses also contain paymentUrl'), '400': errorResponse('Invalid order context'), '401': errorResponse('Authentication or table token required'), '409': errorResponse('Table order is waiting for confirmation') }, bearerOrTableToken),
        parameters: [{ $ref: '#/components/parameters/OrderType' }],
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateOrderRequest' })
      }
    },
    '/order/history': {
      get: {
        ...operation('Get order history', ['Orders'], { '200': successResponse(), '401': errorResponse('Authentication required'), '422': errorResponse('Invalid query') }, bearer),
        parameters: [
          ...paginatedQuery(),
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/OrderStatus' } },
          { name: 'type', in: 'query', schema: { $ref: '#/components/schemas/OrderType' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'tableId', in: 'query', schema: { type: 'string' } },
          { name: 'customerId', in: 'query', schema: { type: 'string', format: 'uuid' } }
        ]
      }
    },
    '/order/kitchen': {
      get: {
        ...operation('Get kitchen queue', ['Orders'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Staff or admin role required') }, bearer),
        parameters: [...paginatedQuery(), { name: 'status', in: 'query', schema: { type: 'string', enum: ['WAITING', 'PREPARING'] } }]
      }
    },
    '/order/kitchen/{itemId}/status': {
      patch: {
        ...operation('Update kitchen item status', ['Orders'], { '200': successResponse(), '400': errorResponse('Invalid order state'), '401': errorResponse('Authentication required'), '403': errorResponse('Staff or admin role required') }, bearer),
        parameters: [idParameter('itemId', 'Order item ID')],
        requestBody: jsonBody({ $ref: '#/components/schemas/KitchenStatusRequest' })
      }
    },
    '/order/{id}/confirm': {
      patch: {
        ...operation('Confirm an order', ['Orders'], { '200': successResponse(), '400': errorResponse('Order cannot be confirmed'), '401': errorResponse('Authentication required'), '403': errorResponse('Staff or admin role required'), '404': errorResponse('Order not found') }, bearer),
        parameters: [idParameter('id', 'Order ID')],
        requestBody: jsonBody({ type: 'object', additionalProperties: false })
      }
    },
    '/order/{id}/reject': {
      patch: {
        ...operation('Reject an order', ['Orders'], { '200': successResponse(), '400': errorResponse('Order cannot be rejected'), '401': errorResponse('Authentication required'), '403': errorResponse('Staff or admin role required') }, bearer),
        parameters: [idParameter('id', 'Order ID')],
        requestBody: jsonBody({ $ref: '#/components/schemas/ReasonRequest' })
      }
    },
    '/order/{id}/serve': {
      patch: {
        ...operation('Serve a ready order', ['Orders'], { '200': successResponse(), '400': errorResponse('Order is not ready'), '401': errorResponse('Authentication required'), '403': errorResponse('Staff or admin role required') }, bearer),
        parameters: [idParameter('id', 'Order ID')],
        requestBody: jsonBody({ type: 'object', additionalProperties: false })
      }
    },
    '/order/{id}/cancel': {
      patch: {
        ...operation('Cancel an order', ['Orders'], { '200': successResponse(), '400': errorResponse('Order cannot be cancelled'), '401': errorResponse('Authentication required'), '403': errorResponse('Access denied'), '409': errorResponse('Paid orders require refund first') }, bearer),
        parameters: [idParameter('id', 'Order ID')],
        requestBody: jsonBody({ $ref: '#/components/schemas/ReasonRequest' })
      }
    },
    '/payment/vnpay/create': {
      post: {
        ...operation('Create VNPay payment URL', ['Payments'], { '200': successResponse(), '400': errorResponse('Order cannot be paid'), '404': errorResponse('Order not found') }),
        requestBody: jsonBody({ $ref: '#/components/schemas/CreatePaymentRequest' })
      }
    },
    '/payment/vnpay/return': {
      get: operation('Handle VNPay browser return', ['Payments'], { '200': successResponse('JSON response when FE_URL is not configured'), '302': { description: 'Redirect to frontend payment result page' } })
    },
    '/payment/vnpay/ipn': {
      get: operation('Handle VNPay server callback', ['Payments'], { '200': { description: 'VNPay acknowledgement' } })
    },
    '/payment/{orderId}': {
      get: {
        ...operation('Get payment detail', ['Payments'], { '200': successResponse(), '404': errorResponse('Payment not found') }),
        parameters: [idParameter('orderId', 'Order ID')]
      }
    },
    '/payment/{orderId}/cash-confirm': {
      patch: {
        ...operation('Confirm cash payment', ['Payments'], { '200': successResponse(), '400': errorResponse('Invalid cash order'), '401': errorResponse('Authentication required'), '403': errorResponse('Staff or admin role required') }, bearer),
        parameters: [idParameter('orderId', 'Order ID')]
      }
    },
    '/reviews/items/{menuItemId}': {
      get: {
        ...operation('List reviews for a menu item', ['Reviews'], { '200': successResponse() }),
        parameters: [idParameter('menuItemId', 'Menu item ID'), ...paginatedQuery(100)]
      }
    },
    '/reviews/feedback': {
      post: {
        ...operation('Create a menu item review', ['Reviews'], { '200': successResponse(), '401': errorResponse('Authentication required'), '403': errorResponse('Review is not allowed'), '422': errorResponse('Validation error') }, bearer),
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateReviewRequest' })
      }
    },
    '/media/upload-image': {
      post: {
        ...operation('Upload images', ['Media'], { '200': successResponse(), '400': errorResponse('Invalid image upload') }),
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['image'],
                properties: {
                  image: { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: 3 }
                }
              }
            }
          }
        }
      }
    },
    '/notifications': {
      get: {
        ...operation('List notifications', ['Notifications'], { '200': successResponse(), '401': errorResponse('Authentication required'), '422': errorResponse('Invalid query') }, bearer),
        parameters: [...paginatedQuery(50), { name: 'unreadOnly', in: 'query', schema: { type: 'boolean', default: false } }]
      }
    },
    '/notifications/unread-count': {
      get: operation('Count unread notifications', ['Notifications'], { '200': successResponse(), '401': errorResponse('Authentication required') }, bearer)
    },
    '/notifications/{id}/read': {
      patch: {
        ...operation('Mark one notification as read', ['Notifications'], { '200': successResponse(), '401': errorResponse('Authentication required'), '404': errorResponse('Notification not found') }, bearer),
        parameters: [idParameter('id', 'MongoDB notification ID', 'string')]
      }
    },
    '/notifications/read-all': {
      patch: operation('Mark all notifications as read', ['Notifications'], { '200': successResponse(), '401': errorResponse('Authentication required') }, bearer)
    }
  },
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'FoodHub access token.' },
      TableTokenAuth: { type: 'apiKey', in: 'header', name: 'X-Table-Token', description: 'Guest token returned by POST /table/scan.' }
    },
    parameters: {
      CartType: { name: 'type', in: 'path', required: true, schema: { $ref: '#/components/schemas/OrderType' } },
      OrderType: { name: 'type', in: 'path', required: true, schema: { $ref: '#/components/schemas/OrderType' } }
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { nullable: true, description: 'Response payload. Shape depends on endpoint.' },
          pagination: { $ref: '#/components/schemas/Pagination' }
        }
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'message'],
        properties: { success: { type: 'boolean', example: false }, message: { type: 'string' }, data: { nullable: true } }
      },
      Pagination: {
        type: 'object',
        required: ['page', 'limit', 'total'],
        properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' } }
      },
      Role: { type: 'string', enum: ['ADMIN', 'STAFF', 'CUSTOMER'] },
      OrderType: { type: 'string', enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] },
      OrderStatus: { type: 'string', enum: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'PAYMENT_FAILED'] },
      PaymentMethod: { type: 'string', enum: ['VNPAY', 'MOMO', 'CASH'] },
      NotificationType: { type: 'string', enum: ['ORDER_CREATED', 'ORDER_PAYMENT_SUCCESS', 'ORDER_PAYMENT_FAILED', 'ORDER_CONFIRMED', 'ORDER_REJECTED', 'ORDER_PREPARING', 'ORDER_READY', 'ORDER_SERVED', 'ORDER_COMPLETED', 'ORDER_CANCELLED', 'ORDER_PAYMENT_RECEIVED'] },
      RegisterRequest: {
        type: 'object', required: ['email', 'password', 'confirmPassword', 'name'],
        properties: {
          email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', minLength: 6, maxLength: 30 }, confirmPassword: { type: 'string', format: 'password' }, name: { type: 'string', maxLength: 100 }, dateOfBirth: { type: 'string', format: 'date', nullable: true }
        }
      },
      LoginRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', minLength: 6 } } },
      RefreshTokenRequest: { type: 'object', required: ['refresh_token'], properties: { refresh_token: { type: 'string' } } },
      VerifyEmailRequest: { type: 'object', required: ['verify_email_token'], properties: { verify_email_token: { type: 'string', minLength: 1 } } },
      EmailRequest: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
      ResetPasswordRequest: { type: 'object', required: ['forgot_password_token', 'new_password', 'confirmNewPassword'], properties: { forgot_password_token: { type: 'string' }, new_password: { type: 'string', format: 'password', minLength: 6, maxLength: 30 }, confirmNewPassword: { type: 'string', format: 'password' } } },
      CreateTableRequest: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 1 }, capacity: { type: 'integer', minimum: 1, default: 2 }, floor: { type: 'string', nullable: true }, note: { type: 'string', nullable: true }, isActive: { type: 'boolean', default: true } } },
      ScanTableRequest: { type: 'object', required: ['qrToken'], properties: { qrToken: { type: 'string', minLength: 1 } } },
      CategoryRequest: { type: 'object', required: ['name', 'icon'], properties: { name: { type: 'string', minLength: 1 }, icon: { type: 'string', minLength: 1 }, sortOrder: { type: 'integer', default: 0 } } },
      CreateMenuItemRequest: { type: 'object', required: ['categoryId', 'name', 'basePrice'], properties: { categoryId: { type: 'string' }, name: { type: 'string', minLength: 2, maxLength: 100 }, description: { type: 'string', nullable: true }, basePrice: { type: 'number', minimum: 0, exclusiveMinimum: true }, image: { type: 'string', format: 'uri', nullable: true }, isAvailable: { type: 'boolean', default: true }, isFeatured: { type: 'boolean', default: true }, sortOrder: { type: 'integer', default: 0 } } },
      UpdateMenuItemRequest: { type: 'object', properties: { categoryId: { type: 'string' }, name: { type: 'string' }, description: { type: 'string', nullable: true }, basePrice: { type: 'number', minimum: 0, exclusiveMinimum: true }, image: { type: 'string', format: 'uri', nullable: true }, isAvailable: { type: 'boolean' }, isFeatured: { type: 'boolean' }, sortOrder: { type: 'integer' } } },
      VariantOptionRequest: { type: 'object', required: ['name'], properties: { id: { type: 'string' }, name: { type: 'string', minLength: 1 }, priceAdd: { type: 'number', minimum: 0, default: 0 }, sortOrder: { type: 'integer', default: 0 }, isActive: { type: 'boolean', default: true } } },
      VariantGroupRequest: { type: 'object', required: ['name', 'options'], properties: { name: { type: 'string', minLength: 1 }, type: { type: 'string', enum: ['SINGLE', 'MULTIPLE'], default: 'SINGLE' }, isRequired: { type: 'boolean', default: true }, sortOrder: { type: 'integer', default: 0 }, options: { type: 'array', minItems: 1, items: { $ref: '#/components/schemas/VariantOptionRequest' } } } },
      UpdateVariantGroupRequest: { allOf: [{ $ref: '#/components/schemas/VariantGroupRequest' }], description: 'All fields are optional at runtime.' },
      FlashSaleRequest: { type: 'object', required: ['itemId', 'discountPercent', 'startsAt', 'endsAt'], properties: { itemId: { type: 'string' }, discountPercent: { type: 'number', minimum: 0.01, maximum: 100 }, startsAt: { type: 'string', format: 'date-time' }, endsAt: { type: 'string', format: 'date-time' }, isActive: { type: 'boolean', default: true }, createdById: { type: 'string' } } },
      CartItemRequest: { type: 'object', required: ['menuItemId', 'quantity'], properties: { id: { type: 'string' }, menuItemId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 99 }, note: { type: 'string', maxLength: 255 }, variantOptionIds: { type: 'array', items: { type: 'string' } }, addedBy: { type: 'string' }, addedAt: { type: 'integer' } } },
      UpdateCartItemRequest: { type: 'object', minProperties: 1, properties: { quantity: { type: 'integer', minimum: 1, maximum: 99 }, note: { type: 'string', maxLength: 255 }, variantOptionIds: { type: 'array', items: { type: 'string' } } } },
      CreateOrderRequest: { type: 'object', properties: { note: { type: 'string' }, paymentMethod: { $ref: '#/components/schemas/PaymentMethod' }, deliveryInfo: { $ref: '#/components/schemas/DeliveryInfo' } } },
      DeliveryInfo: { type: 'object', properties: { fullName: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, note: { type: 'string' } } },
      KitchenStatusRequest: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['PREPARING', 'READY'] } } },
      ReasonRequest: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 1, maxLength: 255 } } },
      CreatePaymentRequest: { type: 'object', required: ['orderCode'], properties: { orderCode: { type: 'string', minLength: 1 } } },
      CreateReviewRequest: { type: 'object', required: ['orderId', 'menuItemId', 'rating'], properties: { orderId: { type: 'string' }, menuItemId: { type: 'string' }, rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string', maxLength: 1000 }, images: { type: 'array', maxItems: 5, items: { type: 'string', format: 'uri' } } } },
      Notification: { type: 'object', properties: { _id: { type: 'string' }, recipientId: { type: 'string' }, recipientRole: { $ref: '#/components/schemas/Role' }, type: { $ref: '#/components/schemas/NotificationType' }, title: { type: 'string' }, message: { type: 'string' }, orderId: { type: 'string', nullable: true }, orderCode: { type: 'string', nullable: true }, metadata: { type: 'object', additionalProperties: true }, readAt: { type: 'string', format: 'date-time', nullable: true }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time' } } }
    }
  }
}

const swaggerBasicAuth = (req: Request, res: Response, next: NextFunction) => {
  const configuredUser = process.env.SWAGGER_USER
  const configuredPassword = process.env.SWAGGER_PASSWORD
  if (!configuredUser || !configuredPassword) {
    return res.status(503).json({ success: false, message: 'Swagger UI credentials are not configured' })
  }

  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="FoodHub Swagger"')
    return res.status(401).send('Authentication required')
  }

  const encoded = authorization.slice('Basic '.length)
  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  const separator = decoded.indexOf(':')
  const user = separator >= 0 ? decoded.slice(0, separator) : ''
  const password = separator >= 0 ? decoded.slice(separator + 1) : ''

  if (user !== configuredUser || password !== configuredPassword) {
    res.setHeader('WWW-Authenticate', 'Basic realm="FoodHub Swagger"')
    return res.status(401).send('Invalid credentials')
  }

  return next()
}

export const registerSwagger = (app: import('express').Express) => {
  const isProduction = process.env.NODE_ENV === 'production'
  const isEnabled = process.env.SWAGGER_ENABLED === 'true' || !isProduction
  if (!isEnabled) return

  const middleware = isProduction ? [swaggerBasicAuth] : []
  app.get('/api-docs.json', ...middleware, (_req, res) => res.json(openApiDocument))
  app.use('/api-docs', ...middleware, swaggerUi.serve, swaggerUi.setup(openApiDocument, {
    explorer: true,
    customSiteTitle: 'FoodHub API Documentation',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, docExpansion: 'list' }
  }))
}
