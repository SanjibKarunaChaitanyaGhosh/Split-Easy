import Message from '../models.js/message.js'
import Expense from '../models.js/expense.js'
import { HttpError } from './httpError.js'
import { escapeHtml, text } from './validate.js'
import { emitToTrip } from './socketRegistry.js'

// simple in-memory rate limit: at most 15 messages per user in 20 seconds
const recent = new Map()
function checkRate(userId) {
    const now = Date.now()
    const times = (recent.get(userId) || []).filter((t) => now - t < 20000)
    if (times.length >= 15) throw new HttpError(429, "You are sending messages too fast. Slow down a little...")
    times.push(now)
    recent.set(userId, times)
}

// Used by BOTH the REST route and the socket handler, so the rules are identical.
export async function createMessage({ trip, user, text: raw, expenseId }) {
    checkRate(user.id)
    // trim, limit to 1000 characters, then escape HTML
    const clean = text(raw, { field: "Message", required: true, max: 1000 })

    const data = { trip: trip._id, sender: user.id, senderName: user.name, text: escapeHtml(clean) }

    if (expenseId) {
        const exp = await Expense.findOne({ _id: expenseId, trip: trip._id })
        if (!exp) throw new HttpError(404, "That expense was not found in this trip")
        data.expense = { id: exp._id, title: exp.title, amount: exp.amount }
    }

    const message = await Message.create(data)
    emitToTrip(String(trip._id), 'message:new', message.toJSON())
    return message
}
