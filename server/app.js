import 'express-async-errors' // makes errors thrown inside async controllers reach errorHandler
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './routes/auth.js'
import tripRoutes from './routes/trip.js'
import invitationRoutes from './routes/invitation.js'
import notificationRoutes from './routes/notification.js'
import sanitize from './middleware/sanitize.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'
import { uploadsDir } from './middleware/upload.js'

const app = express()

// security headers. Bill photos are loaded by the React app, so allow cross-origin images.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }))
// CORS: only the React app's address from .env may call the API
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }))
//parsing
app.use(express.json({ limit: "100kb" }))
app.use(sanitize)

//home Routing
app.get("/", (req, res) => res.status(200).json({ message: "welcome to the SplitEasy API.............." }))
app.get("/api/health", (req, res) => res.status(200).json({ status: "ok" }))

// uploaded bill photos (random file names)
app.use("/uploads", express.static(uploadsDir, { maxAge: "7d" }))

//Routing
app.use("/api/auth", authRoutes)
app.use("/api/trips", tripRoutes)
app.use("/api/invitations", invitationRoutes)
app.use("/api/notifications", notificationRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
