import Expense, { CATEGORIES } from '../models.js/expense.js'
import { HttpError } from '../utils/httpError.js'
import { text, toDate, checkId } from '../utils/validate.js'
import { logActivity } from '../utils/activity.js'
import { notify } from '../utils/notify.js'
import { computeStatus, effectiveSplit } from '../utils/balance.js'
import { removeUpload } from '../middleware/upload.js'

const inr = (n) => `Rs.${Number(n).toLocaleString("en-IN")}`

// ---------------------------------------------------------------------------
// Reading + validating the form (it arrives as multipart/form-data because of the bill photo,
// so arrays like splitAmong arrive as JSON text).
// ---------------------------------------------------------------------------
function parseJson(value, fallback) {
    if (value === undefined || value === "") return fallback
    if (typeof value !== "string") return value
    try { return JSON.parse(value) } catch { throw new HttpError(400, "Invalid form data") }
}

function readExpense(body, trip) {
    const ids = new Set(trip.participants.map((p) => String(p._id)))

    const title = text(body.title, { field: "Title", max: 120, required: true })
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Amount must be greater than 0")
    if (amount > 10000000) throw new HttpError(400, "Amount is too large")
    const rounded = Math.round(amount * 100) / 100

    const category = body.category || "Other"
    if (!CATEGORIES.includes(category)) throw new HttpError(400, `Category must be one of: ${CATEGORIES.join(", ")}`)

    const date = toDate(body.date) || new Date()
    const paidBy = checkId(body.paidBy, "paid by")
    if (!ids.has(paidBy)) throw new HttpError(400, "The person who paid is not part of this trip")

    const splitMode = body.splitMode || "tagged"
    if (!["tagged", "whole"].includes(splitMode)) throw new HttpError(400, "Split mode must be tagged or whole")

    let splitAmong = []
    if (splitMode === "tagged") {
        const raw = parseJson(body.splitAmong, [])
        if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, "Tag at least one person to share this expense")
        splitAmong = [...new Set(raw.map((id) => checkId(id, "tagged person")))]
        if (splitAmong.some((id) => !ids.has(id))) throw new HttpError(400, "A tagged person is not part of this trip")
    }

    let location
    const loc = parseJson(body.location, undefined)
    if (loc && loc.lat !== undefined && loc.lng !== undefined && loc.lat !== "" && loc.lng !== "") {
        const lat = Number(loc.lat), lng = Number(loc.lng)
        if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) throw new HttpError(400, "Location is not valid")
        location = { lat, lng }
    }

    return {
        title, amount: rounded, category, date, paidBy, splitMode, splitAmong, location,
        notes: text(body.notes, { field: "Notes", max: 500 }),
        place: text(body.place, { field: "Place", max: 120 }),
    }
}

// Who has to confirm: everyone who shares the expense + the payer. Whoever made the change
// (`actingParticipantId`) is confirmed automatically.
function buildConfirmations(expense, trip, actingParticipantId) {
    const all = trip.participants.map((p) => String(p._id))
    const needed = new Set([...effectiveSplit(expense, all), String(expense.paidBy)])
    return [...needed].map((pid) => ({
        participant: pid,
        status: pid === String(actingParticipantId) ? "confirmed" : "pending",
        actedBy: pid === String(actingParticipantId) ? expense.createdBy : null,
        at: pid === String(actingParticipantId) ? new Date() : undefined,
    }))
}

const nameOf = (trip, id) => trip.participants.id(id)?.name || "(removed person)"

// registered users who are tagged / have to confirm (used for notifications)
function usersToTell(expense, trip) {
    return expense.confirmations
        .map((c) => trip.participants.id(c.participant)?.user)
        .filter(Boolean)
}

// what the client receives for one expense, with permission flags worked out on the server
function shape(expense, req) {
    const e = expense.toJSON()
    const myC = e.confirmations.find((c) => String(c.participant) === String(req.me._id))
    const isCreator = String(e.createdBy) === req.user.id
    const locked = req.trip.locked
    return {
        ...e,
        myConfirmation: myC ? myC.status : null,
        needsMyConfirmation: Boolean(myC && myC.status === "pending"),
        canEdit: !locked && (req.isAdmin || (isCreator && e.status !== "confirmed")),
        // only the person who added the expense may delete it (the admin cannot)
        canDelete: !locked && isCreator,
        // an admin editing someone else's (or an already confirmed) expense must give a reason
        reasonRequired: req.isAdmin && !(isCreator && e.status !== "confirmed"),
    }
}

// ---------------------------------------------------------------------------
export const list = async (req, res) => {
    const expenses = await Expense.find({ trip: req.trip._id }).sort({ date: -1, createdAt: -1 })
    res.status(200).json({ expenses: expenses.map((e) => { const s = shape(e, req); delete s.versions; return s }) })
}

export const getOne = async (req, res) => {
    const expense = await Expense.findOne({ _id: checkId(req.params.eid, "expense id"), trip: req.trip._id })
    if (!expense) throw new HttpError(404, `Expense ID :${req.params.eid} is not present in the database`)
    res.status(200).json({ expense: shape(expense, req) })
}

export const history = async (req, res) => {
    const expense = await Expense.findOne({ _id: checkId(req.params.eid, "expense id"), trip: req.trip._id })
    if (!expense) throw new HttpError(404, "Expense not found")
    res.status(200).json({ versions: expense.versions })
}

// sending (create)
export const send = async (req, res) => {
    // "paid by" defaults to the person adding the expense
    if (!req.body.paidBy) req.body.paidBy = String(req.me._id)
    const data = readExpense(req.body, req.trip)

    const expense = new Expense({
        ...data,
        trip: req.trip._id,
        createdBy: req.user.id,
        createdByName: req.user.name,
        billImage: req.file ? `/uploads/${req.file.filename}` : "",
    })
    expense.confirmations = buildConfirmations(expense, req.trip, req.me._id)
    expense.status = computeStatus(expense.confirmations)
    await expense.save()

    await logActivity(req.trip, req.user, "expense_added",
        `${req.user.name} added "${expense.title}" (${inr(expense.amount)}) paid by ${nameOf(req.trip, expense.paidBy)}`,
        { expenseId: expense._id })

    await notify(usersToTell(expense, req.trip), {
        trip: req.trip, type: "tagged",
        message: `${req.user.name} tagged you in "${expense.title}" (${inr(expense.amount)}). Please confirm or dispute it`,
        link: `/trips/${req.trip._id}/expenses?open=${expense._id}`,
    }, req.user.id)

    res.status(201).json({ message: "Expense created.....", expense: shape(expense, req) })
}

// updating
export const update = async (req, res) => {
    const expense = await Expense.findOne({ _id: checkId(req.params.eid, "expense id"), trip: req.trip._id })
    if (!expense) { if (req.file) removeUpload(`/uploads/${req.file.filename}`); throw new HttpError(404, `Expense ID :${req.params.eid} is not present in the database`) }

    try {
        const isCreator = String(expense.createdBy) === req.user.id
        // creator: only while pending / disputed.  admin: always, but must give a reason.
        const creatorMayEdit = isCreator && expense.status !== "confirmed"
        if (!creatorMayEdit && !req.isAdmin) {
            throw new HttpError(403, isCreator
                ? "This expense is already confirmed. Raise an edit request so the admin can change it..."
                : "Only the person who added this expense (or the admin) can edit it...")
        }
        const reason = text(req.body.reason, { field: "Reason for edit", max: 300 })
        if (!creatorMayEdit && reason.length < 3) throw new HttpError(400, "Please give a reason for the edit")

        const next = readExpense(req.body, req.trip)
        const before = {
            title: expense.title, amount: expense.amount, category: expense.category, date: expense.date,
            paidBy: String(expense.paidBy), splitMode: expense.splitMode,
            splitAmong: expense.splitAmong.map(String).sort(), notes: expense.notes, place: expense.place,
            location: expense.location?.lat !== undefined ? `${expense.location.lat},${expense.location.lng}` : "",
        }
        const after = { ...next, splitAmong: [...next.splitAmong].sort(), location: next.location ? `${next.location.lat},${next.location.lng}` : "" }

        // build the list of changes for the history
        const changes = []
        const push = (field, from, to) => changes.push({ field, from, to })
        if (before.title !== after.title) push("title", before.title, after.title)
        if (before.amount !== after.amount) push("amount", before.amount, after.amount)
        if (before.category !== after.category) push("category", before.category, after.category)
        if (new Date(before.date).toDateString() !== new Date(after.date).toDateString()) push("date", before.date, after.date)
        if (before.paidBy !== after.paidBy) push("paid by", nameOf(req.trip, before.paidBy), nameOf(req.trip, after.paidBy))
        if (before.splitMode !== after.splitMode) push("split mode", before.splitMode, after.splitMode)
        if (before.splitAmong.join() !== after.splitAmong.join())
            push("split among", before.splitAmong.map((i) => nameOf(req.trip, i)).join(", "), after.splitAmong.map((i) => nameOf(req.trip, i)).join(", "))
        if (before.notes !== after.notes) push("notes", before.notes, after.notes)
        if (before.place !== after.place) push("place", before.place, after.place)
        if (before.location !== after.location) push("location", before.location, after.location)

        let newBill = expense.billImage
        const oldBill = expense.billImage
        if (req.file) { newBill = `/uploads/${req.file.filename}`; push("bill photo", oldBill ? "old photo" : "none", "new photo") }
        else if (req.body.removeBill === "true" && oldBill) { newBill = ""; push("bill photo", "photo", "removed") }

        if (changes.length === 0) throw new HttpError(400, "Nothing was changed")

        Object.assign(expense, next, { billImage: newBill })
        if (!next.location) expense.location = undefined
        // editing resets everybody's confirmation (the editor's own is automatic)
        expense.confirmations = buildConfirmations(expense, req.trip, req.me._id)
        expense.status = computeStatus(expense.confirmations)
        expense.versions.push({ by: req.user.id, byName: req.user.name, at: new Date(), reason, changes })
        await expense.save()
        if (newBill !== oldBill) removeUpload(oldBill)

        await logActivity(req.trip, req.user, "expense_edited",
            `${req.user.name} edited "${expense.title}"${reason ? ` (reason: ${reason})` : ""}`, { expenseId: expense._id, changes })
        await notify(usersToTell(expense, req.trip), {
            trip: req.trip, type: "edited",
            message: `${req.user.name} edited "${expense.title}". Please confirm it again`,
            link: `/trips/${req.trip._id}/expenses?open=${expense._id}`,
        }, req.user.id)

        res.status(200).json({ message: "Expense updated successFully.....", expense: shape(expense, req) })
    } catch (error) {
        if (req.file) removeUpload(`/uploads/${req.file.filename}`) // do not keep an upload for a rejected edit
        throw error
    }
}

export const remove = async (req, res) => {
    const expense = await Expense.findOne({ _id: checkId(req.params.eid, "expense id"), trip: req.trip._id })
    if (!expense) throw new HttpError(404, `Expense ID :${req.params.eid} is not present in the database`)

    // only the person who added the expense can delete it - not other members, not even the admin
    const isCreator = String(expense.createdBy) === req.user.id
    if (!isCreator) throw new HttpError(403, "Only the person who added this expense can delete it...")

    await expense.deleteOne()
    removeUpload(expense.billImage)
    // the expense is gone but stays in the activity log
    await logActivity(req.trip, req.user, "expense_deleted",
        `${req.user.name} deleted "${expense.title}" (${inr(expense.amount)})`, { title: expense.title, amount: expense.amount })
    res.status(200).json({ message: "Expense deleted successfully" })
}

// ---- confirm / dispute -------------------------------------------------------
async function respond(req, res, status) {
    const expense = await Expense.findOne({ _id: checkId(req.params.eid, "expense id"), trip: req.trip._id })
    if (!expense) throw new HttpError(404, "Expense not found")
    if (req.trip.locked) throw new HttpError(403, "This trip is locked...")

    // normally I answer for myself. The admin can answer for a GUEST (guests cannot log in).
    let target = req.me
    if (req.body.participantId && String(req.body.participantId) !== String(req.me._id)) {
        const p = req.trip.participants.id(checkId(req.body.participantId, "participant id"))
        if (!p) throw new HttpError(404, "Participant not found")
        if (!req.isAdmin || p.user) throw new HttpError(403, "Only the admin can answer for a guest...")
        target = p
    }

    const c = expense.confirmations.find((x) => String(x.participant) === String(target._id))
    if (!c) throw new HttpError(400, "This person does not need to confirm this expense")

    let reason = ""
    if (status === "disputed") {
        reason = text(req.body.reason, { field: "Reason", min: 3, max: 300, required: true })
    }
    c.status = status
    c.reason = reason
    c.actedBy = req.user.id
    c.at = new Date()
    const before = expense.status
    expense.status = computeStatus(expense.confirmations)
    await expense.save()

    const who = target === req.me ? req.user.name : `${req.user.name} (for ${target.name})`
    if (status === "confirmed") {
        await logActivity(req.trip, req.user, "expense_confirmed", `${who} confirmed "${expense.title}"`, { expenseId: expense._id })
        if (before !== "confirmed" && expense.status === "confirmed") {
            await logActivity(req.trip, null, "expense_fully_confirmed", `"${expense.title}" is confirmed by everyone`, { expenseId: expense._id })
            await notify([expense.createdBy], { trip: req.trip, type: "confirmed", message: `"${expense.title}" is now confirmed by everyone`, link: `/trips/${req.trip._id}/expenses?open=${expense._id}` }, req.user.id)
        }
    } else {
        await logActivity(req.trip, req.user, "expense_disputed", `${who} disputed "${expense.title}": ${reason}`, { expenseId: expense._id })
        // tell the creator that somebody disagrees
        await notify([expense.createdBy], { trip: req.trip, type: "disputed", message: `${who} disputed "${expense.title}": ${reason}`, link: `/trips/${req.trip._id}/expenses?open=${expense._id}` }, req.user.id)
    }
    res.status(200).json({ message: status === "confirmed" ? "Expense confirmed" : "Expense disputed", expense: shape(expense, req) })
}

export const confirm = (req, res) => respond(req, res, "confirmed")
export const dispute = (req, res) => respond(req, res, "disputed")
