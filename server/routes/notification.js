import express from 'express'
import auth from '../middleware/auth.js'
import { list, readAll, readOne } from '../controllers/notification.js'

const notificationRoutes = express.Router()
notificationRoutes.use(auth)
notificationRoutes.get("/", list)
notificationRoutes.post("/read-all", readAll)
notificationRoutes.patch("/:nid/read", readOne)

export default notificationRoutes
