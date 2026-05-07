import express from 'express'
import { config } from 'dotenv'
import { connectDB } from './config/db'
import routerApp from './routes/router'
import { defaultErrorHandler } from './middlewares/errors.middlewares'
import { redis } from './config/redis'
config()

const PORT = process.env.PORT
const app = express()

app.use(express.json())

connectDB()
redis.connect()

app.use('/api/v1', routerApp)

app.use(defaultErrorHandler)

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})
