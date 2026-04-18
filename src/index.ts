import express from 'express'
import { config } from 'dotenv'
import { connectDB } from './config/db'
config()

const PORT = process.env.PORT
const app = express()

connectDB()

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})
