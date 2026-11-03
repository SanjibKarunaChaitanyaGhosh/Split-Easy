import express from 'express'
import auth from '../middleware/auth.js'
import { mine, accept } from '../controllers/invitation.js'

// invitations addressed to the logged-in user's e-mail
const invitationRoutes = express.Router()
invitationRoutes.use(auth)
invitationRoutes.get("/mine", mine)
invitationRoutes.post("/:iid/accept", accept)

export default invitationRoutes
