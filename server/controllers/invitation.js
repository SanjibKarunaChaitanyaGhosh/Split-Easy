import crypto from 'crypto'
import Invitation from '../models.js/invitation.js'
import Trip from '../models.js/trip.js'
import { HttpError } from '../utils/httpError.js'
import { text, isEmail, checkId } from '../utils/validate.js'
import { logActivity } from '../utils/activity.js'
import { notify } from '../utils/notify.js'
import { sendMail } from '../utils/mailer.js'
import { escapeHtml } from '../utils/validate.js'

const clientUrl = () => (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "")
const linkFor = (invitation) => `${clientUrl()}/join/${invitation.token}`

// sends the invitation e-mail. Never throws: returns { emailSent, emailError }.
async function deliver(trip, invitation, inviterName) {
    const link = linkFor(invitation)
    const result = await sendMail({
        to: invitation.email,
        subject: `${inviterName} invited you to "${trip.name}" on SplitEasy`,
        text: `${inviterName} invited you to join the trip "${trip.name}"${trip.destination ? ` (${trip.destination})` : ""} on SplitEasy.\n\nJoin here: ${link}\n`,
        html: `<p><b>${escapeHtml(inviterName)}</b> invited you to join the trip <b>${escapeHtml(trip.name)}</b>${trip.destination ? ` (${escapeHtml(trip.destination)})` : ""} on SplitEasy.</p><p><a href="${link}">Join the trip</a></p>`,
    })
    return { link, emailSent: result.sent, emailError: result.sent ? undefined : result.error }
}

// POST /api/trips/:id/invitations   (admin, or any member if the admin allowed it)
export const invite = async (req, res) => {
    if (!req.isAdmin && !req.trip.membersCanInvite) {
        throw new HttpError(403, "Only the admin can invite people to this trip...")
    }
    if (req.trip.locked) throw new HttpError(403, "This trip is locked...")

    const email = text(req.body.email, { field: "Email", max: 120, required: true }).toLowerCase()
    if (!isEmail(email)) throw new HttpError(400, "Please enter a valid email")

    const alreadyMember = req.trip.participants.some((p) => p.user && p.email === email)
    if (alreadyMember) throw new HttpError(409, "This person is already in the trip")

    // re-use an open invitation instead of creating a second one
    let invitation = await Invitation.findOne({ trip: req.trip._id, email, status: "pending" })
    if (!invitation) {
        invitation = await Invitation.create({
            trip: req.trip._id, email, token: crypto.randomBytes(20).toString("hex"),
            invitedBy: req.user.id, invitedByName: req.user.name,
        })
        await logActivity(req.trip, req.user, "invitation_sent", `${req.user.name} invited ${email}`)
    }
    const delivery = await deliver(req.trip, invitation, req.user.name)
    res.status(201).json({ message: delivery.emailSent ? "Invitation sent" : "Invitation created", invitation, ...delivery })
}

// GET /api/trips/:id/invitations   (admin) - pending first
export const listInvitations = async (req, res) => {
    const invitations = await Invitation.find({ trip: req.trip._id }).sort({ createdAt: -1 })
    const order = { pending: 0, accepted: 1, cancelled: 2 }
    invitations.sort((a, b) => order[a.status] - order[b.status])
    res.status(200).json({
        invitations: invitations.map((i) => ({ ...i.toJSON(), link: linkFor(i) })),
    })
}

export const resend = async (req, res) => {
    const invitation = await Invitation.findOne({ _id: checkId(req.params.iid, "invitation id"), trip: req.trip._id })
    if (!invitation || invitation.status !== "pending") throw new HttpError(404, "No pending invitation found")
    const delivery = await deliver(req.trip, invitation, req.user.name)
    res.status(200).json({ message: delivery.emailSent ? "Invitation sent again" : "Link ready to share", ...delivery })
}

export const cancel = async (req, res) => {
    const invitation = await Invitation.findOne({ _id: checkId(req.params.iid, "invitation id"), trip: req.trip._id })
    if (!invitation || invitation.status !== "pending") throw new HttpError(404, "No pending invitation found")
    invitation.status = "cancelled"
    await invitation.save()
    await logActivity(req.trip, req.user, "invitation_cancelled", `${req.user.name} cancelled the invitation to ${invitation.email}`)
    res.status(200).json({ message: "Invitation cancelled" })
}

// GET /api/invitations/mine - invitations addressed to MY e-mail (the "you've been invited" banner)
export const mine = async (req, res) => {
    const list = await Invitation.find({ email: req.user.email, status: "pending" }).sort({ createdAt: -1 })
    const out = []
    for (const inv of list) {
        const trip = await Trip.findById(inv.trip)
        if (!trip) continue
        if (trip.participants.some((p) => p.user && String(p.user) === req.user.id)) continue
        out.push({ id: inv._id, token: inv.token, tripName: trip.name, emoji: trip.emoji, destination: trip.destination, invitedByName: inv.invitedByName })
    }
    res.status(200).json({ invitations: out })
}

// POST /api/invitations/:iid/accept - one-click accept
export const accept = async (req, res) => {
    const invitation = await Invitation.findOne({ _id: checkId(req.params.iid, "invitation id"), status: "pending" })
    if (!invitation || invitation.email !== req.user.email) throw new HttpError(404, "Invitation not found")
    const trip = await Trip.findById(invitation.trip)
    if (!trip) throw new HttpError(404, "This trip no longer exists")
    if (trip.locked) throw new HttpError(403, "This trip is locked, so nobody can join right now")

    if (!trip.participants.some((p) => p.user && String(p.user) === req.user.id)) {
        trip.participants.push({ name: req.user.name, user: req.user.id, email: req.user.email, role: "member" })
        await trip.save()
        await logActivity(trip, req.user, "member_joined", `${req.user.name} joined the trip`)
        await notify([trip.admin], { trip, type: "member_joined", message: `${req.user.name} accepted the invitation to "${trip.name}"`, link: `/trips/${trip._id}/people` }, req.user.id)
    }
    invitation.status = "accepted"
    invitation.acceptedBy = req.user.id
    await invitation.save()
    res.status(200).json({ tripId: trip._id })
}
