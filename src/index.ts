import express from 'express'
import { config } from 'dotenv'
import { connectDB } from './config/db'
import routerApp from './routes/router'
config()

const PORT = process.env.PORT
const app = express()

connectDB()

app.use('/api/v1', routerApp)

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})
