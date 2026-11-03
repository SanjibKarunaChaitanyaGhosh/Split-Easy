import Expense from '../models.js/expense.js'
import Payment from '../models.js/payment.js'
import { computeBalances } from '../utils/balance.js'

// Loads everything and runs the pure balance logic. Shared by the summary route and the PDF.
export async function buildSummary(trip, includePending, userId) {
    const [expenses, payments] = await Promise.all([
        Expense.find({ trip: trip._id }).sort({ createdAt: 1 }), // oldest first -> stable rounding
        Payment.find({ trip: trip._id }).sort({ date: 1 }),
    ])

    const result = computeBalances({
        participants: trip.participants.map((p) => ({ id: String(p._id), name: p.name })),
        expenses: expenses.map((e) => ({
            amount: e.amount, paidBy: String(e.paidBy), splitMode: e.splitMode,
            splitAmong: e.splitAmong.map(String), status: e.status,
        })),
        payments: payments.map((p) => ({ from: String(p.from), to: String(p.to), amount: p.amount })),
        includePending,
    })

    const count = (status) => expenses.filter((e) => e.status === status).length
    const me = trip.participants.find((p) => p.user && String(p.user) === userId)

    return {
        ...result,
        includePending,
        participantCount: trip.participants.length,
        expenseCounts: { confirmed: count("confirmed"), pending: count("pending"), disputed: count("disputed") },
        // how many expenses are waiting for MY confirmation (the banner on the overview)
        pendingForMe: me
            ? expenses.filter((e) => e.confirmations.some((c) => String(c.participant) === String(me._id) && c.status === "pending")).length
            : 0,
        mine: me ? result.rows.find((r) => r.id === String(me._id)) : null,
        myParticipantId: me ? String(me._id) : null,
        _expenses: expenses,
        _payments: payments,
    }
}

// GET /api/trips/:id/summary?includePending=true
export const getSummary = async (req, res) => {
    const s = await buildSummary(req.trip, req.query.includePending === "true", req.user.id)
    delete s._expenses
    delete s._payments
    res.status(200).json({ summary: s })
}
