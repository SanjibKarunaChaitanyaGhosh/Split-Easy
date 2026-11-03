import Activity from '../models.js/activity.js'

// GET /api/trips/:id/activity?limit=100
export const list = async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 300)
    const activity = await Activity.find({ trip: req.trip._id }).sort({ createdAt: -1 }).limit(limit)
    res.status(200).json({ activity })
}
