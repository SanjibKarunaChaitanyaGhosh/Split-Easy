import { buildSummary } from './summary.js'
import { writeTripPdf } from '../utils/pdf.js'

// GET /api/trips/:id/pdf?includePending=true   (any member)
export const download = async (req, res) => {
    const s = await buildSummary(req.trip, req.query.includePending === "true", req.user.id)
    const admin = req.trip.participants.find((p) => p.role === "admin")?.name || ""

    const safeName = req.trip.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "trip"
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_bill.pdf"`)

    writeTripPdf(res, { trip: req.trip, expenses: s._expenses, summary: s, payments: s._payments, admin })
}
