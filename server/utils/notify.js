import Notification from '../models.js/notification.js'
import { emitToUser } from './socketRegistry.js'

// Creates an in-app notification for each user (duplicates and empty ids are ignored).
// `exceptUserId` lets you skip the person who did the action.
export const notify = async (userIds, { trip, type, message, link }, exceptUserId) => {
    const unique = [...new Set(userIds.filter(Boolean).map(String))].filter((id) => id !== String(exceptUserId))
    for (const user of unique) {
        const n = await Notification.create({ user, trip: trip?._id || trip, type, message, link })
        emitToUser(user, 'notification', { id: String(n._id) })
    }
}
