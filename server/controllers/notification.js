import Notification from '../models.js/notification.js'
import { checkId } from '../utils/validate.js'

export const list = async (req, res) => {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50)
    const unread = await Notification.countDocuments({ user: req.user.id, read: false })
    res.status(200).json({ notifications, unread })
}

export const readAll = async (req, res) => {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true })
    res.status(200).json({ unread: 0 })
}

export const readOne = async (req, res) => {
    await Notification.updateOne({ _id: checkId(req.params.nid, "notification id"), user: req.user.id }, { read: true })
    const unread = await Notification.countDocuments({ user: req.user.id, read: false })
    res.status(200).json({ unread })
}
