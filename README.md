# FoodHub Backend

Backend REST API và Socket.IO cho hệ thống gọi món FoodHub.

## Tính năng

- Đăng ký, đăng nhập, refresh token, xác thực email và khôi phục mật khẩu.
- Quản lý bàn và QR code cho khách dùng tại bàn.
- Menu công khai, danh mục, món ăn, variant và flash sale.
- Giỏ hàng dùng Redis.
- Đặt món tại bàn, takeaway và delivery.
- Thanh toán tiền mặt và VNPay Sandbox.
- Quản lý bếp và vòng đời đơn hàng.
- Chat realtime giữa khách và nhân viên/admin.
- Cập nhật trạng thái đơn hàng realtime qua Socket.IO.
- Notification lưu MongoDB cho tài khoản đã đăng nhập, có trạng thái đã đọc/chưa đọc.
- Đánh giá món ăn sau khi phục vụ.
- Upload ảnh.

## Kiến trúc dữ liệu

| Thành phần | Vai trò |
| --- | --- |
| PostgreSQL + Prisma | User, table, menu, order, payment, review |
| MongoDB + Mongoose | Conversation, message, notification |
| Redis | Cart, table QR session, cache và dữ liệu tạm |
| Socket.IO | Chat, trạng thái order và sự kiện realtime |

## Chạy dự án

### Yêu cầu

- Node.js phiên bản hỗ trợ TypeScript 6.
- PostgreSQL.
- Redis.
- MongoDB Atlas hoặc MongoDB tương thích.
- Tài khoản VNPay Sandbox nếu sử dụng thanh toán VNPay.

### Cài đặt

```bash
npm install
npx prisma generate
npm run dev
```

Build production:

```bash
npm run build
npm start
```

Server mặc định chạy tại `http://localhost:PORT` và Socket.IO dùng cùng port.
REST API có tiền tố:

```text
/api/v1
```

## Swagger / OpenAPI

Trong development, Swagger UI được bật mặc định tại:

```text
http://localhost:4000/api-docs
```

OpenAPI JSON:

```text
http://localhost:4000/api-docs.json
```

Trong production, Swagger chỉ được bật khi `SWAGGER_ENABLED=true` và bắt buộc Basic Auth bằng `SWAGGER_USER`/`SWAGGER_PASSWORD`. Không commit credential Swagger thật vào repository.

### Biến môi trường

Tạo file `.env` ở thư mục gốc:

```env
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
FE_URL=http://localhost:5173

DATABASE_URL_POSTGRESQL=postgresql://user:password@localhost:5432/foodhub
REDIS_URL=redis://localhost:6379

MONGO_DB_USER=your_mongodb_user
MONGO_DB_PASS=your_mongodb_password

SECRET_ACCESS_TOKEN=change-me
SECRET_REFRESH_TOKEN=change-me
SECRET_VERIFY_EMAIL=change-me
SECRET_FORGOT_PASSWORD=change-me
SECRET_TABLE_TOKEN=change-me

VNPAY_TMN_CODE=your_sandbox_tmn_code
VNPAY_HASH_SECRET=your_sandbox_hash_secret
VNPAY_RETURN_URL=http://localhost:4000/api/v1/payment/vnpay/return

SWAGGER_ENABLED=true
SWAGGER_USER=swagger
SWAGGER_PASSWORD=change-this-password
API_BASE_URL=http://localhost:4000
API_VERSION=1.0.0
```

Email và Cloudflare R2 cần thêm các biến tương ứng được sử dụng trong `src/utils/send-email.ts` và `src/utils/r2.ts`.

## Vai trò

### ADMIN

- Quản lý user theo nghiệp vụ hệ thống.
- Tạo, sửa, xóa và bật/tắt menu.
- Tạo, đổi QR và bật/tắt bàn.
- Quản lý flash sale, variant và order.
- Theo dõi chat và nhận notification vận hành.

### STAFF

- Xem và xử lý order.
- Xem danh sách món trong bếp và cập nhật trạng thái chế biến.
- Xác nhận thanh toán tiền mặt.
- Theo dõi và trả lời chat.

### CUSTOMER

- Đặt món takeaway/delivery khi đăng nhập.
- Xem lịch sử order của tài khoản.
- Thanh toán VNPay hoặc tiền mặt.
- Chat với nhân viên.
- Nhận notification và cập nhật realtime.

## Luồng khách dùng QR tại bàn

### Quy tắc nghiệp vụ

- Mỗi bàn có một QR cố định.
- Nhiều khách có thể quét QR trước khi bàn có order.
- Mỗi lần quét tạo một `sessionId` guest riêng, thời hạn mặc định 8 giờ.
- Tất cả guest cùng bàn dùng chung một cart Redis theo `tableId`.
- Khi một guest đặt món, cart chung được tạo thành order của bàn.
- Guest đã quét trước đó có thể theo dõi order realtime.
- Khách mới không được join bàn khi bàn đang có order thuộc trạng thái sử dụng.
- Sau khi order cũ được quán xác nhận, bàn có thể đặt order bổ sung bằng cart chung.
- Theo implementation hiện tại, `scanQR()` cũng trả bàn đang occupied nếu còn order ở `CANCELLED` hoặc `PAYMENT_FAILED`; cần xử lý/đóng vòng đời bàn trước khi cho khách mới scan lại.

### Quét QR

```http
POST /api/v1/table/scan
Content-Type: application/json

{
	"qrToken": "TOKEN_TU_QR_BAN"
}
```

Response trả về `tableToken`, `sessionId`, thông tin bàn và thời gian hết hạn. Client phải giữ `tableToken` để gọi API dine-in và kết nối Socket.IO.

Cart dine-in dùng table token:

```http
GET /api/v1/cart/DINE_IN/items
X-Table-Token: TABLE_TOKEN
```

Không dùng `sessionId` làm key cart. `sessionId` chỉ định danh guest/socket.

## Luồng khách đăng nhập

- `TAKEAWAY`: có thể dùng user login hoặc session takeaway.
- `DELIVERY`: bắt buộc đăng nhập và chỉ customer/admin được tạo order.
- Gửi access token bằng header:

```http
Authorization: Bearer ACCESS_TOKEN
```

QR table được ưu tiên cho `DINE_IN`; không dùng user token để thay thế table token trong luồng tại bàn.

## REST API chính

### User

| Method | Endpoint | Quyền |
| --- | --- | --- |
| POST | `/user/register` | Public |
| POST | `/user/login` | Public |
| POST | `/user/logout` | Public |
| POST | `/user/refresh-token` | Public |
| GET | `/user/me` | Login |
| POST | `/user/verify-email` | Public |
| POST | `/user/forgot-password` | Public |
| POST | `/user/reset-password` | Public |

### Table và QR

| Method | Endpoint | Quyền |
| --- | --- | --- |
| GET | `/table/:id` | Public |
| POST | `/table/scan` | Public |
| POST | `/table/new` | Admin |
| GET | `/table/:id/qr` | Admin |
| POST | `/table/:id/regenerate-qr` | Admin |
| PATCH | `/table/:id/toggle` | Admin |

### Menu

| Method | Endpoint | Quyền |
| --- | --- | --- |
| GET | `/menu/all` | Public |
| GET | `/menu/item/:id` | Public |
| GET | `/menu/categories` | Public |
| POST/PUT/DELETE | `/menu/categories...` | Admin |
| POST/PATCH/DELETE | `/menu/items...` | Admin |
| GET/PATCH | `/menu/items...` | Admin/Staff |
| POST/PATCH | `/menu/items/:idItem/variants...` | Admin |
| POST/DELETE | `/menu/item/flash-sales...` | Admin |

### Cart

`type` nhận một trong: `DINE_IN`, `TAKEAWAY`, `DELIVERY`.

| Method | Endpoint | Quyền |
| --- | --- | --- |
| GET | `/cart/:type/items` | QR hoặc login tùy loại |
| POST | `/cart/:type/items/add` | QR hoặc login tùy loại |
| PATCH | `/cart/:type/items/:itemId` | QR hoặc login tùy loại |
| DELETE | `/cart/:type/items/:itemId` | QR hoặc login tùy loại |
| DELETE | `/cart/:type/clear` | QR hoặc login tùy loại |

### Order

| Method | Endpoint | Quyền |
| --- | --- | --- |
| POST | `/order/:type/new` | QR hoặc login tùy loại |
| GET | `/order/history` | Login |
| GET | `/order/kitchen` | Admin/Staff |
| PATCH | `/order/kitchen/:itemId/status` | Admin/Staff |
| PATCH | `/order/:id/confirm` | Admin/Staff |
| PATCH | `/order/:id/reject` | Admin/Staff |
| PATCH | `/order/:id/serve` | Admin/Staff |
| PATCH | `/order/:id/cancel` | Login |

Order status chính:

```text
PENDING_PAYMENT -> PENDING_CONFIRMATION -> CONFIRMED -> PREPARING
-> READY -> SERVED -> COMPLETED
```

Nhánh lỗi/hủy: `PAYMENT_FAILED`, `CANCELLED`.

`COMPLETED` đã có trong domain order nhưng hiện chưa có endpoint riêng để chuyển trực tiếp từ `SERVED` sang `COMPLETED`.

### Payment

| Method | Endpoint | Quyền |
| --- | --- | --- |
| POST | `/payment/vnpay/create` | Public |
| GET | `/payment/vnpay/return` | VNPay redirect |
| GET | `/payment/vnpay/ipn` | VNPay callback |
| GET | `/payment/:orderId` | Public |
| PATCH | `/payment/:orderId/cash-confirm` | Admin/Staff |

### Review và media

| Method | Endpoint | Quyền |
| --- | --- | --- |
| GET | `/reviews/items/:menuItemId` | Public |
| POST | `/reviews/feedback` | Login |
| POST | `/media/upload-image` | Endpoint hiện tại không bắt buộc auth |

### Notification

Notification chỉ lưu cho tài khoản đăng nhập. Guest QR chỉ nhận realtime, không có notification cá nhân trong MongoDB.

| Method | Endpoint | Quyền |
| --- | --- | --- |
| GET | `/notifications` | Login |
| GET | `/notifications/unread-count` | Login |
| PATCH | `/notifications/:id/read` | Login |
| PATCH | `/notifications/read-all` | Login |

Query danh sách:

```text
GET /api/v1/notifications?page=1&limit=20&unreadOnly=true
```

## Socket.IO

Kết nối cùng host/port REST API.

### User login

```ts
const socket = io('http://localhost:4000', {
	auth: { token: accessToken }
})
```

### Guest QR

```ts
const socket = io('http://localhost:4000', {
	auth: { tableToken }
})
```

### Order events

Client join order:

```ts
socket.emit('order:join', { orderId }, (result) => {
	console.log(result)
})
```

Client leave order:

```ts
socket.emit('order:leave', { orderId })
```

Server events:

| Event | Ý nghĩa |
| --- | --- |
| `order:status:update` | Trạng thái order thay đổi |
| `order:item:update` | Trạng thái món trong bếp thay đổi |
| `order:new` | Sự kiện order mới, nếu client sử dụng |

Guest QR được join order nếu order thuộc `tableId` của table token. Customer login được join nếu order thuộc `customerId` của tài khoản.

### Chat events

| Event | Hướng | Ý nghĩa |
| --- | --- | --- |
| `conversation:join` | Client -> Server | Vào conversation và nhận history |
| `message:send` | Client -> Server | Gửi tin nhắn |
| `message:history` | Server -> Client | Lịch sử tin nhắn |
| `message:new` | Server -> Client | Tin nhắn mới |
| `conversation:new` | Server -> Host | Conversation mới |
| `conversation:updated` | Server -> Host | Conversation cập nhật |
| `typing:start` | Hai chiều | Bắt đầu nhập |
| `typing:stop` | Hai chiều | Dừng nhập |

Conversation được gom theo:

- `tableId` đối với khách dine-in.
- `userId` đối với khách login takeaway/delivery.

## Realtime và notification

- Socket.IO dùng cho cập nhật ngay lập tức khi client đang online.
- MongoDB notification dùng để xem lại thông báo khi user login không online.
- Notification không tạo cho từng trạng thái món trong bếp để tránh dữ liệu dư thừa.
- Các notification order chính gồm tạo order, thanh toán, xác nhận, từ chối, chuẩn bị, sẵn sàng, phục vụ, hoàn thành và hủy.
- Notification `ORDER_COMPLETED` đã được định nghĩa, nhưng chỉ có dữ liệu khi hệ thống có luồng chuyển order sang `COMPLETED`.

## Lưu ý vận hành

- Không commit file `.env` hoặc secret lên repository.
- VNPay hiện cấu hình Sandbox trong `src/config/vnpay.ts`.
- Table token có thời hạn mặc định 8 giờ và cần được gửi bằng `X-Table-Token` cho API dine-in.
- Access token chỉ dùng cho API/user socket; table token chỉ dùng cho session QR.
- Khi đổi QR bàn, token cũ không nên tiếp tục được sử dụng ở client.
- Cần khởi động PostgreSQL, Redis và MongoDB trước khi chạy backend.

## Scripts

```bash
npm run dev       # Chạy development với nodemon
npm run build     # TypeScript build
npm start         # Chạy bản build trong dist
npm run lint      # Kiểm tra ESLint
npm run lint:fix  # Tự sửa các lỗi ESLint có thể sửa
```
