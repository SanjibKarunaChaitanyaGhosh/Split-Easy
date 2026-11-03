import crypto from 'crypto'
import Trip from '../models.js/trip.js'
import Expense from '../models.js/expense.js'
import Payment from '../models.js/payment.js'
import Invitation from '../models.js/invitation.js'
import EditRequest from '../models.js/editRequest.js'
import Activity from '../models.js/activity.js'
import Message from '../models.js/message.js'
import Notification from '../models.js/notification.js'
import { HttpError } from '../utils/httpError.js'
import { text, toDate, checkId, isEmail } from '../utils/validate.js'
import { logActivity } from '../utils/activity.js'
import { notify } from '../utils/notify.js'
import { computeStatus } from '../utils/balance.js'
import { removeUpload } from '../middleware/upload.js'
import { tripView } from '../utils/tripView.js'

// ---- helpers ---------------------------------------------------------------
function readTripFields(body) {
    const name = text(body.name, { field: "Trip name", min: 2, max: 80, required: true })
    const destination = text(body.destination, { field: "Destination", max: 100 })
    const description = text(body.description, { field: "Description", max: 500 })
    const emoji = text(body.emoji, { field: "Emoji", max: 8 }) || "✈️"
    const startDate = toDate(body.startDate, "Start date")
    const endDate = toDate(body.endDate, "End date")
    if (startDate && endDate && endDate < startDate) throw new HttpError(400, "End date cannot be before the start date")
    return { name, destination, description, emoji, startDate, endDate }
}

// finds a trip from an invite-link token OR an e-mail invitation token
async function resolveToken(token) {
    const trip = await Trip.findOne({ inviteToken: token })
    if (trip) {
        if (!trip.inviteEnabled) throw new HttpError(410, "This invite link has been turned off by the admin")
        return { trip }
    }
    const invitation = await Invitation.findOne({ token, status: "pending" })
    if (invitation) {
        const t = await Trip.findById(invitation.trip)
        if (t) return { trip: t, invitation }
    }
    throw new HttpError(404, "This invite link is not valid any more")
}

// ---- trips -----------------------------------------------------------------
export const createTrip = async (req, res) => {
    const fields = readTripFields(req.body)
    const trip = await Trip.create({
        ...fields,
        admin: req.user.id,
        participants: [{ name: req.user.name, user: req.user.id, email: req.user.email, role: "admin" }],
    })
    await logActivity(trip, req.user, "trip_created", `${req.user.name} created the trip "${trip.name}"`)
    res.status(201).json({ message: "Trip created.....", trip: { _id: trip._id } })
}

// my trips (dashboard cards)
export const myTrips = async (req, res) => {
    const trips = await Trip.find({ "participants.user": req.user.id }).sort({ createdAt: -1 })
    res.status(200).json({
        trips: trips.map((t) => ({
            _id: t._id,
            name: t.name,
            emoji: t.emoji,
            destination: t.destination,
            startDate: t.startDate,
            endDate: t.endDate,
            locked: t.locked,
            memberCount: t.participants.length,
            role: t.participants.find((p) => p.user && String(p.user) === req.user.id)?.role,
        })),
    })
}

export const getTrip = async (req, res) => {
    res.status(200).json({ trip: tripView(req.trip, req) })
}

export const updateTrip = async (req, res) => {
    const trip = req.trip
    if (trip.locked) throw new HttpError(403, "This trip is locked. Unlock it before editing...")
    Object.assign(trip, readTripFields(req.body))
    if (req.body.membersCanInvite !== undefined) trip.membersCanInvite = Boolean(req.body.membersCanInvite)
    await trip.save()
    await logActivity(trip, req.user, "trip_updated", `${req.user.name} updated the trip details`)
    res.status(200).json({ message: "Trip updated.....", trip: tripView(trip, req) })
}

export const deleteTrip = async (req, res) => {
    const trip = req.trip
    const expenses = await Expense.find({ trip: trip._id })
    expenses.forEach((e) => removeUpload(e.billImage))
    await Promise.all([
        Expense.deleteMany({ trip: trip._id }),
        Payment.deleteMany({ trip: trip._id }),
        Invitation.deleteMany({ trip: trip._id }),
        EditRequest.deleteMany({ trip: trip._id }),
        Activity.deleteMany({ trip: trip._id }),
        Message.deleteMany({ trip: trip._id }),
        Notification.deleteMany({ trip: trip._id }),
    ])
    await trip.deleteOne()
    res.status(200).json({ message: "Trip deleted successfully" })
}

// lock = final settlement. admin can unlock again.
export const lockTrip = async (req, res) => {
    const locked = Boolean(req.body.locked)
    req.trip.locked = locked
    await req.trip.save()
    await logActivity(req.trip, req.user, locked ? "trip_locked" : "trip_unlocked",
        locked ? `${req.user.name} locked the trip (final settlement)` : `${req.user.name} unlocked the trip`)
    await notify(req.trip.participants.map((p) => p.user), {
        trip: req.trip, type: "trip_lock",
        message: locked ? `"${req.trip.name}" was locked for final settlement` : `"${req.trip.name}" was unlocked`,
        link: `/trips/${req.trip._id}`,
    }, req.user.id)
    res.status(200).json({ message: locked ? "Trip locked" : "Trip unlocked", trip: tripView(req.trip, req) })
}

// ---- invite link -----------------------------------------------------------
export const inviteLink = async (req, res) => {
    const action = req.body.action
    if (action === "regenerate") req.trip.inviteToken = crypto.randomBytes(16).toString("hex")
    else if (action === "disable") req.trip.inviteEnabled = false
    else if (action === "enable") req.trip.inviteEnabled = true
    else throw new HttpError(400, "action must be regenerate, enable or disable")
    await req.trip.save()
    await logActivity(req.trip, req.user, "invite_link", `${req.user.name} ${action}d the invite link`.replace("enabled", "turned on").replace("disabled", "turned off"))
    res.status(200).json({ message: "Invite link updated", trip: tripView(req.trip, req) })
}

// public preview shown BEFORE logging in
export const previewByToken = async (req, res) => {
    const { trip } = await resolveToken(req.params.token)
    const adminP = trip.participants.find((p) => p.role === "admin")
    res.status(200).json({
        preview: {
            name: trip.name, emoji: trip.emoji, destination: trip.destination,
            startDate: trip.startDate, endDate: trip.endDate,
            adminName: adminP?.name || "", memberCount: trip.participants.length,
        },
    })
}

export const joinByToken = async (req, res) => {
    const { trip, invitation } = await resolveToken(req.params.token)

    const already = trip.participants.find((p) => p.user && String(p.user) === req.user.id)
    if (already) return res.status(200).json({ tripId: trip._id, alreadyMember: true })

    if (trip.locked) throw new HttpError(403, "This trip is locked, so nobody can join right now")

    trip.participants.push({ name: req.user.name, user: req.user.id, email: req.user.email, role: "member" })
    await trip.save()

    // close any pending e-mail invitations for this person
    if (invitation) {
        invitation.status = "accepted"
        invitation.acceptedBy = req.user.id
        await invitation.save()
    }
    await Invitation.updateMany({ trip: trip._id, email: req.user.email, status: "pending" }, { status: "accepted", acceptedBy: req.user.id })

    await logActivity(trip, req.user, "member_joined", `${req.user.name} joined the trip`)

    // a guest with the same e-mail may be this person -> hint the admin to merge
    const guest = trip.participants.find((p) => !p.user && p.email && p.email === req.user.email)
    await notify([trip.admin], {
        trip, type: "member_joined",
        message: guest
            ? `${req.user.name} joined "${trip.name}". Guest "${guest.name}" has the same e-mail - you may want to merge them`
            : `${req.user.name} joined "${trip.name}"`,
        link: `/trips/${trip._id}/people`,
    }, req.user.id)

    res.status(200).json({ tripId: trip._id, alreadyMember: false })
}

// ---- guests & participants -------------------------------------------------
export const addGuest = async (req, res) => {
    if (req.trip.locked) throw new HttpError(403, "This trip is locked...")
    const name = text(req.body.name, { field: "Guest name", min: 1, max: 60, required: true })
    const email = text(req.body.email, { field: "Email", max: 120 }).toLowerCase()
    if (email && !isEmail(email)) throw new HttpError(400, "Please enter a valid email")

    const dup = req.trip.participants.some((p) => p.name.toLowerCase() === name.toLowerCase())
    if (dup) throw new HttpError(409, "Someone with this name is already in the trip")

    req.trip.participants.push({ name, email, role: "member" })
    await req.trip.save()
    await logActivity(req.trip, req.user, "guest_added", `${req.user.name} added guest "${name}"`)
    res.status(201).json({ message: "Guest added.....", trip: tripView(req.trip, req) })
}

export const removeParticipant = async (req, res) => {
    if (req.trip.locked) throw new HttpError(403, "This trip is locked...")
    const pid = checkId(req.params.pid, "participant id")
    const target = req.trip.participants.id(pid)
    if (!target) throw new HttpError(404, "Participant not found")
    if (target.role === "admin") throw new HttpError(400, "The trip admin cannot be removed")

    // removing someone who is part of any expense would change everybody's balances
    const used = await Expense.exists({
        trip: req.trip._id,
        $or: [{ paidBy: pid }, { splitAmong: pid }, { splitMode: "whole" }],
    })
    const paid = await Payment.exists({ trip: req.trip._id, $or: [{ from: pid }, { to: pid }] })
    if (used || paid) {
        throw new HttpError(400, "This person is part of the trip's expenses or payments, so they cannot be removed. (Guests can be merged into a real user instead.)")
    }

    const name = target.name
    // reassign the array (a plain $set) instead of subdocument.deleteOne() ($pull)
    req.trip.participants = req.trip.participants.filter((p) => String(p._id) !== pid)
    await req.trip.save()
    await logActivity(req.trip, req.user, "member_removed", `${req.user.name} removed ${name} from the trip`)
    res.status(200).json({ message: "Participant removed", trip: tripView(req.trip, req) })
}

// Merge a guest into a real participant so nobody is counted twice.
// Everything that pointed at the guest is moved to the real person.
export const mergeGuest = async (req, res) => {
    if (req.trip.locked) throw new HttpError(403, "This trip is locked...")
    const guestId = checkId(req.params.gid, "guest id")
    const targetId = checkId(req.body.targetParticipantId, "target participant id")

    const guest = req.trip.participants.id(guestId)
    const target = req.trip.participants.id(targetId)
    if (!guest || guest.user) throw new HttpError(400, "The first person must be a guest")
    if (!target || !target.user) throw new HttpError(400, "A guest can only be merged into a registered member")

    const g = String(guestId)
    const swap = (id) => (String(id) === g ? target._id : id)

    const expenses = await Expense.find({ trip: req.trip._id })
    for (const e of expenses) {
        e.paidBy = swap(e.paidBy)
        const split = [...new Set(e.splitAmong.map((id) => String(swap(id))))]
        e.splitAmong = split
        // one confirmation per person: keep the real user's own, drop the guest's duplicate
        const seen = new Set()
        const merged = []
        for (const c of e.confirmations) {
            const pid = String(swap(c.participant))
            if (seen.has(pid)) continue
            seen.add(pid)
            c.participant = swap(c.participant)
            merged.push(c)
        }
        e.confirmations = merged
        e.status = computeStatus(e.confirmations)
        await e.save()
    }

    // payments: move them, and delete any that become "paid yourself"
    const payments = await Payment.find({ trip: req.trip._id, $or: [{ from: g }, { to: g }] })
    for (const p of payments) {
        if (String(p.from) === g) p.from = target._id
        if (String(p.to) === g) p.to = target._id
        if (String(p.from) === String(p.to)) await p.deleteOne()
        else await p.save()
    }

    const guestName = guest.name
    req.trip.participants = req.trip.participants.filter((p) => String(p._id) !== g)
    await req.trip.save()
    await logActivity(req.trip, req.user, "guest_merged", `${req.user.name} merged guest "${guestName}" into ${target.name}`)
    res.status(200).json({ message: "Guest merged.....", trip: tripView(req.trip, req) })
}
