# FoodHub: deploy free thanh API production

Tai lieu nay huong dan deploy FoodHub thanh mot backend public co REST API va Socket.IO. Kien truc hien tai dung nhieu dich vu nen khong the chi deploy mot Node process:

| Thanh phan | Dich vu free de dung | Du lieu/chuc nang |
| --- | --- | --- |
| Backend Node.js | Render Web Service | Express, Socket.IO, Swagger |
| PostgreSQL | Neon | Prisma, user, menu, order, payment |
| MongoDB | MongoDB Atlas M0 | conversation, message, notification |
| Redis | Upstash Redis | cart, QR session, cache |
| Anh | Cloudflare R2 | anh menu/upload |
| Email | Resend | verify email, forgot password |
| Frontend | Vercel | React/Vite |

Ten goi, gioi han va chinh sach free cua cac nha cung cap co the thay doi. Free Render co the sleep khi khong co traffic; request dau tien sau khi sleep se cham. Day la gioi han ha tang, khong phai loi API.

## 1. Kiem tra truoc khi deploy

### 1.1. Stack hien tai

- Backend: Express 5 + TypeScript.
- Realtime: Socket.IO dung chung HTTP port voi REST.
- REST prefix: `/api/v1`.
- Swagger: `/api-docs` va `/api-docs.json`.
- Prisma schema: `prisma/schema`.
- Migration: `prisma/migrations`.
- Frontend hien co nam trong `FEclient/SocketClient`.

Build backend da co san:

```bash
npm ci
npx prisma generate
npm run build
npm start
```

Build frontend:

```bash
cd FEclient/SocketClient
npm ci
npm run build
```

### 1.2. Cac blocker cua source hien tai

Can xu ly cac muc sau truoc khi xem deploy la production-ready:

1. `src/index.ts` goi `initConnectSystem()` nhung khong `await`; process co the listen truoc khi database san sang.
2. `PORT` dang lay truc tiep tu env; Render cung cap `PORT`, nhung local nen co fallback.
3. REST chua co middleware CORS. Socket.IO cho `origin: '*'`, nhung browser van co the chan REST tu Vercel.
4. Link email trong `src/utils/send-email.ts` dang hard-code `https://localhost:3000`.
5. `send-email.ts` doc `template-email.html` tu `__dirname`, nhung build TypeScript khong tu dong copy file HTML vao `dist`.
6. `src/utils/r2.ts` dung cung `R2_URL_ENDPOINT` cho endpoint S3 va public URL. Hai gia tri nay thuong khac nhau; nen tach `R2_S3_ENDPOINT` va `R2_PUBLIC_URL`.
7. MongoDB URI dang hard-code hostname cluster, chi thay username/password bang env. Neu doi cluster thi phai sua code hoac tach thanh `MONGODB_URI`.

> Neu chua sua code, van co the deploy de test cac API khong dung email/anh, nhung khong nen coi do la ban production hoan chinh.

## 2. Patch toi thieu truoc deploy

Day la huong sua nho, giu nguyen API public.

### 2.1. Khoi dong co await va health endpoint

Trong `src/index.ts`, doi startup thanh async va them health route truoc khi listen. Y tuong:

```ts
const PORT = Number(process.env.PORT || 4000)

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'foodhub-api' })
})

const start = async () => {
  await initConnectSystem()
  initFolderUpload()
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FoodHub API listening on port ${PORT}`)
  })
}

start().catch((error) => {
  console.error('Startup failed', error)
  process.exit(1)
})
```

Khong giu dong `initConnectSystem()` roi `listen()` song song voi doan tren.

> Health endpoint nay chi kiem tra process dang song. Neu can readiness that su, hay kiem tra them ket noi PostgreSQL, MongoDB va Redis.

### 2.2. CORS cho frontend

Cai package:

```bash
npm install cors
npm install -D @types/cors
```

Them truoc cac route:

```ts
import cors from 'cors'

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}))
```

Neu co nhieu frontend, tach env bang dau phay va viet allow-list; khong dung `origin: '*'` cung voi credentials.

Socket.IO cung nen dung cung origin:

```ts
cors: {
  origin: process.env.CLIENT_URL,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}
```

### 2.3. URL email va template

Them env `FRONTEND_URL` hoac dung `CLIENT_URL` trong `send-email.ts` thay cho `https://localhost:3000`:

```ts
const frontendUrl = process.env.CLIENT_URL!
button_url: `${frontendUrl}/verify?token=${verifyToken}`
button_url: `${frontendUrl}/forgot-password?token=${forgotPasswordToken}`
```

Them script copy template sau build, vi du tren Windows/Linux deu chay duoc voi `shx`:

```bash
npm install -D shx
```

Sua script:

```json
"build": "rimraf ./dist && tsc && tsc-alias && shx cp src/utils/template-email.html dist/utils/template-email.html"
```

Hoac copy file bang mot buoc build tuong ung voi CI cua ban. Sau build phai ton tai `dist/utils/template-email.html`.

### 2.4. R2 public URL

Khuyen nghi:

- `R2_S3_ENDPOINT`: endpoint API cua bucket.
- `R2_PUBLIC_URL`: custom domain/public bucket URL, vi du `https://cdn.example.com`.

S3Client dung `R2_S3_ENDPOINT`; URL tra ve dung `R2_PUBLIC_URL`. Khong expose access key len frontend.

## 3. Tao cac dich vu free

### 3.1. Neon PostgreSQL

1. Tao account Neon va mot project, region gan nguoi dung.
2. Tao database `foodhub`.
3. Copy connection string PostgreSQL.
4. Neu Neon cung cap pooled/direct URL, dung URL phu hop voi Prisma; giu nguyen query parameter ma Neon cap.
5. Khong commit URL vao git.

Gia tri can dat cho backend:

```text
DATABASE_URL_POSTGRESQL=postgresql://user:password@host/dbname?sslmode=require
```

### 3.2. MongoDB Atlas

1. Tao cluster M0.
2. Tao database user rieng cho FoodHub.
3. Trong Network Access, cho phep outbound IP cua platform. Vi free Render co IP dong, cach don gian nhat la `0.0.0.0/0` voi password manh va user chi co quyen tren database FoodHub.
4. Kiem tra username/password da URL-encode neu co ky tu dac biet.
5. Dat `MONGO_DB_USER` va `MONGO_DB_PASS` theo source hien tai.

Neu muon dung URI cluster khac, sua code de nhan `MONGODB_URI`:

```text
MONGODB_URI=mongodb+srv://.../foodhub?retryWrites=true&w=majority
```

### 3.3. Upstash Redis

1. Tao database Redis free.
2. Copy Redis URL TLS ma Upstash cung cap, thuong bat dau bang `rediss://`.
3. Dat:

```text
REDIS_URL=rediss://default:password@host:6379
```

Khong bo trong `REDIS_URL`: fallback `redis://localhost:6379` khong ton tai tren Render.

### 3.4. Cloudflare R2

1. Tao bucket.
2. Tao API token chi co quyen Object Read/Write tren bucket.
3. Lay S3 API endpoint, access key va secret.
4. Bat public access bang custom domain hoac public bucket URL neu anh can hien thi tren frontend.
5. Dat cac env R2 theo ten source hien tai; neu da tach endpoint/public URL thi dung ten moi o muc 2.4.

### 3.5. Resend

1. Tao API key.
2. Verify domain gui mail, hoac dung sender duoc Resend cho phep trong giai doan test.
3. Dat dung ten env co phan biet hoa thuong:

```text
ResendAPIKey=re_...
From_Send_Email=FoodHub <noreply@your-domain.example>
```

Neu chua verify domain, email co the chi gui duoc den dia chi test duoc phep boi Resend.

### 3.6. VNPay

Source hien tai dang dung sandbox (`testMode: true`). Dung credential sandbox:

```text
VNPAY_TMN_CODE=...
VNPAY_HASH_SECRET=...
VNPAY_RETURN_URL=https://<backend-domain>/api/v1/payment/vnpay/return
```

VNPay phai goi duoc IPN public:

```text
GET https://<backend-domain>/api/v1/payment/vnpay/ipn
```

`return` la redirect trinh duyet; `ipn` la callback server-to-server. Khong dat ca hai thanh URL localhost.

## 4. Deploy backend tren Render

### 4.1. Tao Web Service

1. Push repository len GitHub.
2. Render -> New -> Web Service -> ket noi repository.
3. Neu repository root la FoodHub, dat:

```text
Root Directory: .
Runtime: Node
Build Command: npm ci && npx prisma generate && npm run build && npx prisma migrate deploy
Start Command: npm start
Health Check Path: /health
```

4. Chon free instance neu tai khoan con ho tro.
5. Khong dung `npm run dev` tren Render.
6. Khong dung `prisma migrate dev` tren production.

`prisma migrate deploy` se chay migration chua ap dung theo thu tu trong `prisma/migrations`. Database phai da duoc tao dung va `DATABASE_URL_POSTGRESQL` phai co truoc buoc build/deploy.

### 4.2. Environment variables tren Render

Dat trong Render -> Environment, khong commit `.env`:

```env
NODE_ENV=production
PORT=10000

CLIENT_URL=https://<frontend>.vercel.app
FE_URL=https://<frontend>.vercel.app

DATABASE_URL_POSTGRESQL=postgresql://...
REDIS_URL=rediss://...
MONGO_DB_USER=...
MONGO_DB_PASS=...

SECRET_ACCESS_TOKEN=<random-long-value>
SECRET_REFRESH_TOKEN=<random-long-value>
SECRET_VERIFY_EMAIL=<random-long-value>
SECRET_FORGOT_PASSWORD=<random-long-value>
SECRET_TABLE_TOKEN=<random-long-value>

VNPAY_TMN_CODE=...
VNPAY_HASH_SECRET=...
VNPAY_RETURN_URL=https://<render-service>.onrender.com/api/v1/payment/vnpay/return

R2_URL_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_NAME_BUCKET=...

ResendAPIKey=...
From_Send_Email=...

SWAGGER_ENABLED=true
SWAGGER_USER=<strong-user>
SWAGGER_PASSWORD=<strong-password>
API_BASE_URL=https://<render-service>.onrender.com
API_VERSION=1.0.0
```

Render tu cap `PORT`; co the de trong env hoac bo qua de platform inject. Code phai cast sang number va listen tren `0.0.0.0`.

Tao secret random, vi du:

```bash
openssl rand -base64 48
```

Neu may khong co OpenSSL, dung password manager sinh 4 chuoi dai, khac nhau. Khong dung `change-me`.

### 4.3. Lay URL backend

Sau deploy, vi du:

```text
https://foodhub-api.onrender.com
```

Kiem tra:

```bash
curl -i https://foodhub-api.onrender.com/health
curl -u "<swagger-user>:<swagger-password>" https://foodhub-api.onrender.com/api-docs.json
```

Ket qua health mong doi co HTTP `200` va JSON `ok: true`. Neu Render restart lien tuc, doc log startup de tim loi Prisma, MongoDB hoac Redis.

## 5. Deploy frontend tren Vercel

1. Vercel -> Add New Project -> chon repository.
2. Root Directory: `FEclient/SocketClient`.
3. Framework: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Deploy.

Frontend hien co URL backend/socket hard-code trong source. Can thay cac URL `http://localhost:4000` va `http://localhost:3000` bang env Vite, vi du:

```env
VITE_API_URL=https://foodhub-api.onrender.com/api/v1
VITE_SOCKET_URL=https://foodhub-api.onrender.com
```

Trong code frontend:

```ts
const API_URL = import.meta.env.VITE_API_URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
```

Sau khi co URL Vercel, quay lai Render cap nhat:

```text
CLIENT_URL=https://<frontend>.vercel.app
FE_URL=https://<frontend>.vercel.app
```

Neu dung custom domain, dung domain do trong ca Vercel, Render env, CORS, QR content va VNPay return URL.

## 6. Checklist kiem thu sau deploy

### Process va database

- [ ] `/health` tra `200`.
- [ ] Log co ket noi PostgreSQL, MongoDB va Redis thanh cong.
- [ ] Render khong restart loop.
- [ ] Migration da chay thanh cong; khong dung `migrate dev`.
- [ ] Swagger mo duoc qua Basic Auth.

### REST

- [ ] `GET /api/v1/menu/all` tra du lieu hoac response hop le.
- [ ] Register/login tra token.
- [ ] Request tu frontend khong bi CORS error.
- [ ] Access token gui bang `Authorization: Bearer ...`.
- [ ] Dine-in gui `X-Table-Token`.

### Redis va order

- [ ] Scan QR tao session.
- [ ] Cart khong mat ngay sau khi tao.
- [ ] Tao order va doc lich su order duoc.

### MongoDB va Socket.IO

- [ ] User login ket noi Socket.IO bang `auth.token`.
- [ ] Guest QR ket noi bang `auth.tableToken`.
- [ ] Chat join/send/receive duoc.
- [ ] Order status event toi client.

### Email, anh, payment

- [ ] Email verify link tro den domain frontend, khong con `localhost`.
- [ ] `dist/utils/template-email.html` ton tai.
- [ ] Upload tra ve URL public tai duoc tu browser.
- [ ] VNPay sandbox redirect ve frontend.
- [ ] VNPay IPN truy cap duoc backend public.

## 7. Loi thuong gap

### Render bao `Application failed to respond`

- Process khong listen `process.env.PORT`.
- Server listen `localhost` thay vi `0.0.0.0`.
- Startup bi treo do MongoDB/Redis/PostgreSQL.
- Xem log startup va thu `/health`.

### Prisma bao khong tim thay generated client

Chay `npx prisma generate` trong Build Command truoc `npm run build`. Thu muc `src/generated/prisma` la output generated, khong nen tu sua tay.

### MongoDB timeout

Kiem tra Network Access Atlas. Free platform co IP dong; can allow dung pham vi IP phu hop va kiem tra password da encode.

### Redis connect error

Dung URL `rediss://` Upstash cap, khong dung fallback localhost. Kiem tra database Upstash con quota.

### Frontend goi localhost

Tim toan bo `localhost:4000` va `localhost:3000` trong `FEclient/SocketClient/src`, thay bang `VITE_API_URL`/`VITE_SOCKET_URL`, sau do build lai Vercel.

### Upload thanh cong nhung anh khong hien

`R2_URL_ENDPOINT` co the la S3 API endpoint, khong phai public URL. Cau hinh custom domain/public access va tach `R2_PUBLIC_URL`.

### Email loi `ENOENT template-email.html`

Build chua copy template vao `dist/utils`. Sua build script theo muc 2.3 va deploy lai.

## 8. Bao mat toi thieu

- Khong commit `.env`, JWT secret, database URL, R2 secret, Resend key hay VNPay secret.
- Dung Basic Auth cho Swagger va tat `SWAGGER_ENABLED` neu khong can public docs.
- Khong dung `origin: '*'` neu frontend gui credentials/cookie.
- Tao database user rieng, quyen toi thieu.
- Khong log access token, refresh token, password hoac secret.
- Theo doi quota free cua Neon, Atlas, Upstash, R2, Resend va Render.
- Free instance co the sleep va Redis/Mongo/Postgres free co gioi han; can co retry o client va khong phu thuoc vao filesystem local.

## 9. Quy trinh deploy moi lan push code

```text
1. Sua code local.
2. npm run lint
3. npm run build
4. Kiem tra migration moi neu co thay doi schema.
5. Push GitHub.
6. Render chay npm ci -> prisma generate -> build -> migrate deploy -> start.
7. Kiem tra /health, menu, login va Socket.IO.
8. Vercel build lai frontend neu co thay doi frontend/env.
```

Ban public sau khi hoan tat se co dang:

```text
REST:     https://<backend>/api/v1/...
Socket:   https://<backend>
Swagger:  https://<backend>/api-docs
Health:   https://<backend>/health
Frontend: https://<frontend>
```