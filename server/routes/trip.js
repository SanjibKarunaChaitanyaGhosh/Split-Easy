import express from 'express'
import auth from '../middleware/auth.js'
import tripAccess, { adminOnly } from '../middleware/tripAccess.js'
import {
    createTrip, myTrips, getTrip, updateTrip, deleteTrip, lockTrip, inviteLink,
    previewByToken, joinByToken, addGuest, removeParticipant, mergeGuest,
} from '../controllers/trip.js'
import { invite, listInvitations, resend, cancel } from '../controllers/invitation.js'
import * as requests from '../controllers/request.js'
import * as payments from '../controllers/payment.js'
import * as messages from '../controllers/message.js'
import { getSummary } from '../controllers/summary.js'
import { list as activityList } from '../controllers/activity.js'
import { download } from '../controllers/pdf.js'
import expenseRoutes from './expense.js'

const tripRoutes = express.Router()

// PUBLIC: preview of an invite link (shown before the person logs in)
tripRoutes.get("/join/:token", previewByToken)

// everything below needs a logged in user
tripRoutes.use(auth)

tripRoutes.get("/", myTrips)
tripRoutes.post("/", createTrip)
tripRoutes.post("/join/:token", joinByToken)

// ---- one trip (tripAccess = must be a member) ----
tripRoutes.get("/:id", tripAccess, getTrip)
tripRoutes.put("/:id", tripAccess, adminOnly, updateTrip)
tripRoutes.delete("/:id", tripAccess, adminOnly, deleteTrip)
tripRoutes.post("/:id/lock", tripAccess, adminOnly, lockTrip)
tripRoutes.post("/:id/invite-link", tripAccess, adminOnly, inviteLink)

// participants & guests
tripRoutes.post("/:id/guests", tripAccess, adminOnly, addGuest)
tripRoutes.post("/:id/guests/:gid/merge", tripAccess, adminOnly, mergeGuest)
tripRoutes.delete("/:id/participants/:pid", tripAccess, adminOnly, removeParticipant)

// invitations by e-mail
tripRoutes.post("/:id/invitations", tripAccess, invite)
tripRoutes.get("/:id/invitations", tripAccess, adminOnly, listInvitations)
tripRoutes.post("/:id/invitations/:iid/resend", tripAccess, adminOnly, resend)
tripRoutes.delete("/:id/invitations/:iid", tripAccess, adminOnly, cancel)

// expenses
tripRoutes.use("/:id/expenses", tripAccess, expenseRoutes)

// edit requests
tripRoutes.get("/:id/requests", tripAccess, requests.list)
tripRoutes.post("/:id/requests", tripAccess, requests.create)
tripRoutes.put("/:id/requests/:rid", tripAccess, requests.resolve)

// payments (settlements)
tripRoutes.get("/:id/payments", tripAccess, payments.list)
tripRoutes.post("/:id/payments", tripAccess, payments.create)
tripRoutes.delete("/:id/payments/:pid", tripAccess, payments.remove)

// summary, activity, pdf
tripRoutes.get("/:id/summary", tripAccess, getSummary)
tripRoutes.get("/:id/activity", tripAccess, activityList)
tripRoutes.get("/:id/pdf", tripAccess, download)

// chat (REST part; live messages go through socket.io)
tripRoutes.get("/:id/messages", tripAccess, messages.list)
tripRoutes.post("/:id/messages", tripAccess, messages.send)
tripRoutes.get("/:id/messages/unread", tripAccess, messages.unread)
tripRoutes.post("/:id/messages/read", tripAccess, messages.markRead)

export default tripRoutes
