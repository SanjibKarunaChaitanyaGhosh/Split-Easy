import Trip from '../models.js/trip.js'
import { HttpError } from '../utils/httpError.js'
import { checkId } from '../utils/validate.js'

// Runs AFTER auth on every /api/trips/:id/... route.
// Loads the trip and checks the logged-in user is a member. The check is done on the
// SERVER so nobody can read or change a trip just by knowing its id.
//   req.trip    -> the trip document
//   req.me      -> my participant entry inside the trip
//   req.isAdmin -> true when I am the trip admin
const tripAccess = async (req, res, next) => {
    const id = checkId(req.params.id, "trip id")

    const trip = await Trip.findById(id)
    if (!trip) throw new HttpError(404, `Trip ID :${id} is not present in the database`)

    const me = trip.participants.find((p) => p.user && String(p.user) === req.user.id)
    if (!me) throw new HttpError(403, "You are not a member of this trip...")

    req.trip = trip
    req.me = me
    req.isAdmin = me.role === "admin"
    next()
}

export const adminOnly = (req, res, next) => {
    if (!req.isAdmin) throw new HttpError(403, "Only the trip admin can do this...")
    next()
}

// blocks changes once the trip is locked (final settlement)
export const notLocked = (req, res, next) => {
    if (req.trip.locked) throw new HttpError(403, "This trip is locked. The admin must unlock it first...")
    next()
}

export default tripAccess
