import EditRequest from '../models.js/editRequest.js'
import Expense from '../models.js/expense.js'
import { HttpError } from '../utils/httpError.js'
import { text, checkId } from '../utils/validate.js'
import { logActivity } from '../utils/activity.js'
import { notify } from '../utils/notify.js'

// GET /api/trips/:id/requests - full history of edit requests
export const list = async (req, res) => {
    const requests = await EditRequest.find({ trip: req.trip._id }).sort({ createdAt: -1 })
    // flag which ones I am allowed to resolve (admin, or the creator of the expense concerned)
    const expenseIds = requests.map((r) => r.expense).filter(Boolean)
    const expenses = await Expense.find({ _id: { $in: expenseIds } }).select("createdBy")
    const creatorOf = Object.fromEntries(expenses.map((e) => [String(e._id), String(e.createdBy)]))
    res.status(200).json({
        requests: requests.map((r) => ({
            ...r.toJSON(),
            canResolve: r.status === "open" && (req.isAdmin || (r.expense && creatorOf[String(r.expense)] === req.user.id)),
        })),
    })
}

// POST - any member can raise a request
export const create = async (req, res) => {
    const reason = text(req.body.reason, { field: "Reason", min: 3, max: 500, required: true })
    const correction = text(req.body.correction, { field: "What needs to be corrected", min: 3, max: 500, required: true })

    let expense = null
    if (req.body.expenseId) {
        expense = await Expense.findOne({ _id: checkId(req.body.expenseId, "expense id"), trip: req.trip._id })
        if (!expense) throw new HttpError(404, "That expense was not found in this trip")
    }

    const request = await EditRequest.create({
        trip: req.trip._id,
        expense: expense?._id || null,
        expenseTitle: expense?.title || "",
        requestedBy: req.user.id,
        requestedByName: req.user.name,
        reason, correction,
    })

    await logActivity(req.trip, req.user, "request_raised",
        `${req.user.name} raised an edit request${expense ? ` about "${expense.title}"` : ""}: ${correction}`, { requestId: request._id })

    // tell the admin and the person who made the expense
    await notify([req.trip.admin, expense?.createdBy], {
        trip: req.trip, type: "request",
        message: `${req.user.name} raised an edit request${expense ? ` about "${expense.title}"` : ""}`,
        link: `/trips/${req.trip._id}/requests`,
    }, req.user.id)

    res.status(201).json({ message: "Request raised.....", request })
}

// PUT /:rid - admin or the expense creator marks it Resolved / Rejected
export const resolve = async (req, res) => {
    const request = await EditRequest.findOne({ _id: checkId(req.params.rid, "request id"), trip: req.trip._id })
    if (!request) throw new HttpError(404, "Request not found")
    if (request.status !== "open") throw new HttpError(400, "This request is already closed")

    const status = req.body.status
    if (!["resolved", "rejected"].includes(status)) throw new HttpError(400, "Status must be resolved or rejected")

    let allowed = req.isAdmin
    if (!allowed && request.expense) {
        const exp = await Expense.findById(request.expense).select("createdBy")
        allowed = exp && String(exp.createdBy) === req.user.id
    }
    if (!allowed) throw new HttpError(403, "Only the admin or the person who added the expense can close this request...")

    request.status = status
    request.resolvedBy = req.user.id
    request.resolvedByName = req.user.name
    request.resolvedNote = text(req.body.note, { field: "Note", max: 300 })
    request.resolvedAt = new Date()
    await request.save()

    await logActivity(req.trip, req.user, "request_resolved", `${req.user.name} marked an edit request as ${status}`, { requestId: request._id })
    await notify([request.requestedBy], {
        trip: req.trip, type: "request",
        message: `Your edit request was ${status} by ${req.user.name}`,
        link: `/trips/${req.trip._id}/requests`,
    }, req.user.id)

    res.status(200).json({ message: `Request ${status}`, request })
}
