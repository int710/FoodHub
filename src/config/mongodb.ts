import mongoose from 'mongoose'
import { config } from 'dotenv'
config()

const uri = `mongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASS}@int710.22yimso.mongodb.net/?appName=int710`

export const connectMongodb = async () => {
  try {
    await mongoose.connect(uri)
    console.log('Connected mongodb successfully !')
  } catch (err) {
    console.log('You connected mongodb failed', err)
    throw err
  }
}
