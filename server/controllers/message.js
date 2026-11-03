import Message from '../models.js/message.js'
import { HttpError } from '../utils/httpError.js'
import { createMessage } from '../utils/chat.js'
import { checkId } from '../utils/validate.js'

// GET /api/trips/:id/messages?before=<messageId>&limit=50  -> newest 50, oldest first
export const list = async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const filter = { trip: req.trip._id }
    if (req.query.before) filter._id = { $lt: checkId(req.query.before, "message id") }

    const found = await Message.find(filter).sort({ _id: -1 }).limit(limit + 1)
    const hasMore = found.length > limit
    const messages = found.slice(0, limit).reverse()
    res.status(200).json({ messages, hasMore })
}

// POST - REST fallback; the app normally sends through the socket
export const send = async (req, res) => {
    const message = await createMessage({ trip: req.trip, user: req.user, text: req.body.text, expenseId: req.body.expenseId })
    res.status(201).json({ message })
}

// unread count = messages from other people after I last opened the chat
export const unread = async (req, res) => {
    const since = req.me.lastReadChat || new Date(0)
    const count = await Message.countDocuments({ trip: req.trip._id, createdAt: { $gt: since }, sender: { $ne: req.user.id } })
    res.status(200).json({ unread: count })
}

export const markRead = async (req, res) => {
    const me = req.trip.participants.id(req.me._id)
    if (!me) throw new HttpError(404, "Participant not found")
    me.lastReadChat = new Date()
    await req.trip.save()
    res.status(200).json({ unread: 0 })
}
