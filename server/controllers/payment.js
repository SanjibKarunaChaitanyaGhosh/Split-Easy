import Payment from '../models.js/payment.js'
import { HttpError } from '../utils/httpError.js'
import { text, toDate, checkId } from '../utils/validate.js'
import { logActivity } from '../utils/activity.js'
import { notify } from '../utils/notify.js'

export const list = async (req, res) => {
    const payments = await Payment.find({ trip: req.trip._id }).sort({ date: -1, createdAt: -1 })
    const name = (id) => req.trip.participants.id(id)?.name || "(removed)"
    res.status(200).json({
        payments: payments.map((p) => ({
            ...p.toJSON(), fromName: name(p.from), toName: name(p.to),
            canDelete: req.isAdmin || String(p.recordedBy) === req.user.id,
        })),
    })
}

// "Mark as paid": records that `from` really paid `to`. Allowed for the payer, the receiver or the admin.
// (Allowed even when the trip is locked - settling up is exactly what a locked trip is for.)
export const create = async (req, res) => {
    const from = checkId(req.body.from, "payer")
    const to = checkId(req.body.to, "receiver")
    const amount = Math.round(Number(req.body.amount) * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Amount must be greater than 0")
    if (from === to) throw new HttpError(400, "Payer and receiver must be different people")

    const fromP = req.trip.participants.id(from)
    const toP = req.trip.participants.id(to)
    if (!fromP || !toP) throw new HttpError(400, "Both people must be part of this trip")

    const involved = String(req.me._id) === from || String(req.me._id) === to
    if (!involved && !req.isAdmin) throw new HttpError(403, "Only the payer, the receiver or the admin can record this payment...")

    const payment = await Payment.create({
        trip: req.trip._id, from, to, amount,
        date: toDate(req.body.date) || new Date(),
        note: text(req.body.note, { field: "Note", max: 200 }),
        recordedBy: req.user.id, recordedByName: req.user.name,
    })

    await logActivity(req.trip, req.user, "payment_recorded",
        `${req.user.name} recorded: ${fromP.name} paid ${toP.name} Rs.${amount.toLocaleString("en-IN")}`, { paymentId: payment._id })
    await notify([fromP.user, toP.user], {
        trip: req.trip, type: "payment",
        message: `${fromP.name} paid ${toP.name} Rs.${amount.toLocaleString("en-IN")}`,
        link: `/trips/${req.trip._id}/settle`,
    }, req.user.id)

    res.status(201).json({ message: "Payment recorded.....", payment })
}

export const remove = async (req, res) => {
    const payment = await Payment.findOne({ _id: checkId(req.params.pid, "payment id"), trip: req.trip._id })
    if (!payment) throw new HttpError(404, "Payment not found")
    if (!req.isAdmin && String(payment.recordedBy) !== req.user.id) {
        throw new HttpError(403, "Only the person who recorded this payment (or the admin) can delete it...")
    }
    await payment.deleteOne()
    await logActivity(req.trip, req.user, "payment_deleted", `${req.user.name} deleted a recorded payment of Rs.${payment.amount.toLocaleString("en-IN")}`)
    res.status(200).json({ message: "Payment deleted" })
}
