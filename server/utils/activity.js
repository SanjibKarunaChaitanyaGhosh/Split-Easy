import Activity from '../models.js/activity.js'

// writes one line of the trip's activity log. `actor` is req.user (or null for the system).
export const logActivity = (trip, actor, type, message, meta) =>
    Activity.create({
        trip: trip._id || trip,
        actor: actor?.id,
        actorName: actor?.name || "System",
        type,
        message,
        meta,
    })
