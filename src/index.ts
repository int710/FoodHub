import express from 'express'
import { config } from 'dotenv'
import { createServer } from 'http'
import { initConnectSystem } from './config/db'
import routerApp from './routes/router'
import { defaultErrorHandler } from './middlewares/errors.middlewares'
import { initFolderUpload } from './utils/file'
import { initSocket } from './socket/socket'
import { registerSwagger } from './config/swagger'

config()

const PORT = Number(process.env.PORT || 4000)
const app = express()
const httpServer = createServer(app)
initSocket(httpServer)
app.use(express.json())
registerSwagger(app)

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'foodhub-api'
  })
})

app.use('/api/v1', routerApp)
app.use(defaultErrorHandler)

const start = async () => {
  await initConnectSystem()
  initFolderUpload()

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FoodHub API listening on port ${PORT}`)
    console.log(`Health check: http://localhost:${PORT}/health`)
    console.log(`Socket.IO running on port ${PORT}`)
  })
}

start().catch((error) => {
  console.error('Startup failed:', error)
  process.exit(1)
})