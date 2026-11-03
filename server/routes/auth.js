import express from 'express'
import { register, login, me } from '../controllers/auth.js'
import auth from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'

const authRoutes = express.Router()

authRoutes.post("/register", authLimiter, register)
authRoutes.post("/login", authLimiter, login)
authRoutes.get("/me", auth, me)

export default authRoutes
