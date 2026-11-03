import mongoose from 'mongoose'
import 'dotenv/config'

// connects to MongoDB. Throws on failure so server.js can stop with a clear message.
const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Mongo_URL Database Connected successfully....")
    } catch (error) {
        console.error("Database connection failed:", error.message)
        throw error
    }
}

export default connectDb
