import express from 'express'
import { config } from 'dotenv'
import { initConnectSystem } from './config/db'
import routerApp from './routes/router'
import { defaultErrorHandler } from './middlewares/errors.middlewares'
import { initFolderUpload } from './utils/file'
import { createServer } from 'http'
import { initSocket } from './socket/socket'
config()

const PORT = process.env.PORT
const app = express()
// Tạo server websocket
const httpServer = createServer(app);
const io = initSocket(httpServer)

app.use(express.json())

initConnectSystem()
initFolderUpload()

app.use('/api/v1', routerApp)
app.use(defaultErrorHandler)

httpServer.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
  console.log(`Socket.IO running at ws://localhost:${PORT}`)
})
