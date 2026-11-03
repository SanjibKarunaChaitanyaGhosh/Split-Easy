import 'dotenv/config'
import http from 'http'
import app from './app.js'
import connectDb from './database/db.js'
import { initSocket } from './socket.js'

const port = process.env.PORT || 8000

if (!process.env.Jwt_SECRET_KEY || !process.env.MONGO_URI) {
    console.error("Missing MONGO_URI or Jwt_SECRET_KEY. Copy .env.example to .env and fill them in.")
    process.exit(1)
}

try {
    await connectDb()
} catch (error) {
    console.error("Application cannot start:", error.message)
    process.exit(1)
}

const server = http.createServer(app)
initSocket(server, process.env.CLIENT_URL || "http://localhost:5173")

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})
