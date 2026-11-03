// =====================================================================
// Money logic. PURE functions only (no database), so they are easy to
// unit-test and easy to explain.
// All maths is done in integer PAISE (1 rupee = 100 paise) to avoid the
// floating point errors of 0.1 + 0.2.
// =====================================================================

export const toPaise = (rupees) => Math.round(Number(rupees) * 100)
export const toRupees = (paise) => paise / 100

// Splits `total` paise into n parts. The leftover paise (the remainder) are
// given one each to the first parts, so the parts ALWAYS add up to the total.
// e.g. splitPaise(1000, 3) -> [334, 333, 333]
export function splitPaise(total, n) {
    const base = Math.floor(total / n)
    const rest = total - base * n
    return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0))
}

// who shares an expense: everyone in the trip ("whole") or only the tagged people
export function effectiveSplit(expense, allParticipantIds) {
    if (expense.splitMode === 'whole') return allParticipantIds.map(String)
    return (expense.splitAmong || []).map(String)
}

// Status of an expense from its confirmations (see section 5 of the spec):
//   any dispute -> 'disputed', everyone confirmed -> 'confirmed', otherwise 'pending'
export function computeStatus(confirmations) {
    if (confirmations.some((c) => c.status === 'disputed')) return 'disputed'
    if (confirmations.every((c) => c.status === 'confirmed')) return 'confirmed'
    return 'pending'
}

// does this expense count towards the balances?
export function countsInBalances(expense, includePending) {
    if (expense.status === 'confirmed') return true
    return includePending && expense.status === 'pending'
}

/**
 * Works out, for every participant: paid, share, payments sent/received and net balance.
 * participants: [{ id, name }]
 * expenses:     [{ amount, paidBy, splitMode, splitAmong, status }]   (amount in rupees)
 * payments:     [{ from, to, amount }]                                (settlements already made)
 * net > 0  => the person gets money back.  net < 0 => the person owes money.
 */
export function computeBalances({ participants, expenses, payments = [], includePending = false }) {
    const ids = participants.map((p) => String(p.id))
    const rows = {}
    participants.forEach((p) => {
        rows[String(p.id)] = { id: String(p.id), name: p.name, paid: 0, share: 0, sent: 0, received: 0 }
    })

    let totalSpent = 0
    let countedExpenses = 0
    // how many "extra" paise each person has already been given. The leftover paise of
    // each expense go to the people who have had the fewest so far, so over many
    // expenses nobody is always the one who pays the extra paisa.
    const extras = {}
    ids.forEach((id) => (extras[id] = 0))

    for (const e of expenses) {
        if (!countsInBalances(e, includePending)) continue
        const amount = toPaise(e.amount)
        totalSpent += amount
        countedExpenses++

        if (rows[String(e.paidBy)]) rows[String(e.paidBy)].paid += amount

        const members = effectiveSplit(e, ids).filter((id) => rows[id])
        if (members.length === 0) continue

        const base = Math.floor(amount / members.length)
        const rest = amount - base * members.length // leftover paise, 0 .. n-1
        members.forEach((id) => (rows[id].share += base))

        // fewest extras first; ties are broken by id so the result is deterministic
        const order = [...members].sort((a, b) => extras[a] - extras[b] || (a < b ? -1 : 1))
        for (let i = 0; i < rest; i++) {
            rows[order[i]].share += 1
            extras[order[i]] += 1
        }
    }

    for (const p of payments) {
        const amount = toPaise(p.amount)
        if (rows[String(p.from)]) rows[String(p.from)].sent += amount
        if (rows[String(p.to)]) rows[String(p.to)].received += amount
    }

    const result = Object.values(rows).map((r) => ({
        id: r.id,
        name: r.name,
        paid: toRupees(r.paid),
        share: toRupees(r.share),
        sent: toRupees(r.sent),
        received: toRupees(r.received),
        // paying a debt raises your balance, receiving a payment lowers it
        net: toRupees(r.paid - r.share + r.sent - r.received),
    }))

    return {
        rows: result,
        totalSpent: toRupees(totalSpent),
        countedExpenses,
        // trip total divided equally between everybody (the "trip-level view")
        equalShare: participants.length ? toRupees(Math.round(totalSpent / participants.length)) : 0,
        settlements: suggestSettlements(result),
    }
}

// Greedy settle-up: repeatedly make the biggest debtor pay the biggest creditor.
// It never needs more than (people - 1) payments.
export function suggestSettlements(rows) {
    const debtors = rows.filter((r) => toPaise(r.net) < 0).map((r) => ({ id: r.id, name: r.name, left: -toPaise(r.net) }))
    const creditors = rows.filter((r) => toPaise(r.net) > 0).map((r) => ({ id: r.id, name: r.name, left: toPaise(r.net) }))
    const out = []

    while (debtors.length && creditors.length) {
        debtors.sort((a, b) => b.left - a.left)
        creditors.sort((a, b) => b.left - a.left)
        const d = debtors[0]
        const c = creditors[0]
        const pay = Math.min(d.left, c.left)
        out.push({ from: d.id, fromName: d.name, to: c.id, toName: c.name, amount: toRupees(pay) })
        d.left -= pay
        c.left -= pay
        if (d.left === 0) debtors.shift()
        if (c.left === 0) creditors.shift()
    }
    return out
}
