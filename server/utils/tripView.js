// How a trip is sent to the client. Guest/e-mail details are only shown to the admin.
export function tripView(trip, req) {
    const t = trip.toObject ? trip.toObject() : trip
    return {
        _id: t._id,
        name: t.name,
        destination: t.destination,
        startDate: t.startDate,
        endDate: t.endDate,
        description: t.description,
        emoji: t.emoji,
        admin: t.admin,
        locked: t.locked,
        membersCanInvite: t.membersCanInvite,
        inviteEnabled: t.inviteEnabled,
        inviteToken: req.isAdmin ? t.inviteToken : undefined,
        participants: t.participants.map((p) => ({
            _id: p._id,
            name: p.name,
            role: p.role,
            registered: Boolean(p.user),
            email: req.isAdmin ? p.email : undefined,
        })),
        me: { participantId: req.me._id, role: req.me.role },
        createdAt: t.createdAt,
    }
}
