import { Server } from 'socket.io'
import Trip from './models.js/trip.js'
import { userFromToken } from './middleware/auth.js'
import { createMessage } from './utils/chat.js'
import { setIO } from './utils/socketRegistry.js'

// Real-time chat. Every socket is authenticated with the SAME JWT as the REST API.
// One room per trip ("trip:<id>") and one per user ("user:<id>", used for notifications).
export function initSocket(httpServer, clientOrigin) {
    const io = new Server(httpServer, { cors: { origin: clientOrigin, credentials: true } })
    setIO(io)

    io.use(async (socket, next) => {
        try {
            socket.user = await userFromToken(socket.handshake.auth?.token)
            next()
        } catch (error) {
            next(new Error("unauthorized"))
        }
    })

    // is this socket's user a member of the trip? (checked on every join / send)
    const memberOf = async (tripId, userId) => {
        const trip = await Trip.findById(tripId)
        const ok = trip && trip.participants.some((p) => p.user && String(p.user) === userId)
        return ok ? trip : null
    }

    io.on("connection", (socket) => {
        socket.join(`user:${socket.user.id}`)

        socket.on("trip:join", async (tripId, ack) => {
            try {
                if (!(await memberOf(tripId, socket.user.id))) return ack?.({ ok: false, error: "Not a member of this trip" })
                socket.join(`trip:${tripId}`)
                ack?.({ ok: true })
            } catch { ack?.({ ok: false, error: "Could not join" }) }
        })

        socket.on("trip:leave", (tripId) => socket.leave(`trip:${tripId}`))

        // "typing..." indicator (only for people who joined the room)
        socket.on("typing", ({ tripId } = {}) => {
            if (socket.rooms.has(`trip:${tripId}`)) socket.to(`trip:${tripId}`).emit("typing", { tripId, name: socket.user.name })
        })

        socket.on("message:send", async ({ tripId, text, expenseId } = {}, ack) => {
            try {
                const trip = await memberOf(tripId, socket.user.id)
                if (!trip) return ack?.({ ok: false, error: "Not a member of this trip" })
                const message = await createMessage({ trip, user: socket.user, text, expenseId })
                ack?.({ ok: true, message })
            } catch (error) {
                ack?.({ ok: false, error: error.status && error.status < 500 ? error.message : "Could not send the message" })
            }
        })
    })
    return io
}
