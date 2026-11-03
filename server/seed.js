// Creates demo data so the app can be shown straight away:   npm run seed
// WARNING: it first EMPTIES the SplitEasy collections in the database from MONGO_URI.
import 'dotenv/config'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import connectDb from './database/db.js'
import User from './models.js/user.js'
import Trip from './models.js/trip.js'
import Expense from './models.js/expense.js'
import Payment from './models.js/payment.js'
import EditRequest from './models.js/editRequest.js'
import Activity from './models.js/activity.js'
import Message from './models.js/message.js'
import Notification from './models.js/notification.js'
import Invitation from './models.js/invitation.js'
import { computeStatus } from './utils/balance.js'

await connectDb()
for (const M of [User, Trip, Expense, Payment, EditRequest, Activity, Message, Notification, Invitation]) await M.deleteMany({})

const hash = await bcrypt.hash("demo123", 10)
const [asha, ravi, meera] = await User.create([
    { name: "Asha Sharma", email: "asha@demo.com", password: hash },
    { name: "Ravi Kumar", email: "ravi@demo.com", password: hash },
    { name: "Meera Nair", email: "meera@demo.com", password: hash },
])

const trip = await Trip.create({
    name: "Goa Beach Trip", destination: "Goa", emoji: "🏖️",
    description: "Long weekend with college friends",
    startDate: new Date("2026-01-09"), endDate: new Date("2026-01-12"),
    admin: asha._id,
    participants: [
        { name: asha.name, user: asha._id, email: asha.email, role: "admin" },
        { name: ravi.name, user: ravi._id, email: ravi.email, role: "member" },
        { name: meera.name, user: meera._id, email: meera.email, role: "member" },
        { name: "Kiran (guest)", email: "kiran@example.com", role: "member" },
    ],
})
const [pA, pR, pM, pK] = trip.participants.map((p) => p._id)
const all = [pA, pR, pM, pK]

// helper: builds an expense whose confirmations are given as { participantId: "confirmed|pending|disputed" }
async function addExpense(by, data, answers) {
    const confirmations = Object.entries(answers).map(([participant, status]) => ({
        participant, status, reason: status === "disputed" ? "Price was Rs.2500, not Rs.3000" : "", at: new Date(),
    }))
    return Expense.create({
        trip: trip._id, createdBy: by.id, createdByName: by.name, ...data,
        confirmations, status: computeStatus(confirmations),
    })
}
const yes = (ids) => Object.fromEntries(ids.map((i) => [i, "confirmed"]))

const hotel = await addExpense(asha, { title: "Beach hotel (3 nights)", amount: 6000, category: "Stay", place: "Calangute", paidBy: pA, splitMode: "whole", date: new Date("2026-01-09") }, yes(all))
await addExpense(ravi, { title: "Lunch at the shack", amount: 1000, category: "Food", place: "Baga", paidBy: pR, splitMode: "whole", date: new Date("2026-01-10"), location: { lat: 15.5553, lng: 73.7517 } }, yes(all))
await addExpense(meera, { title: "Dinner", amount: 2000, category: "Food", place: "Anjuna", paidBy: pM, splitMode: "whole", date: new Date("2026-01-10") }, yes(all))
const scooter = await addExpense(ravi, { title: "Scooter rental", amount: 1200, category: "Transport", paidBy: pR, splitMode: "tagged", splitAmong: [pR, pM, pK], date: new Date("2026-01-11") }, { [pR]: "confirmed", [pM]: "pending", [pK]: "pending" })
await addExpense(asha, { title: "Water sports", amount: 3000, category: "Tickets", place: "Candolim", paidBy: pA, splitMode: "tagged", splitAmong: [pA, pR], date: new Date("2026-01-11") }, { [pA]: "confirmed", [pR]: "disputed" })

await Payment.create({ trip: trip._id, from: pK, to: pA, amount: 500, note: "Kiran paid cash", recordedBy: asha._id, recordedByName: asha.name })
await EditRequest.create({ trip: trip._id, expense: scooter._id, expenseTitle: scooter.title, requestedBy: meera._id, requestedByName: meera.name, reason: "We only rented it for 2 days", correction: "Amount should be Rs.800" })

const log = (actor, type, message) => Activity.create({ trip: trip._id, actor: actor?._id, actorName: actor?.name || "System", type, message })
await log(asha, "trip_created", `Asha Sharma created the trip "Goa Beach Trip"`)
await log(ravi, "member_joined", "Ravi Kumar joined the trip")
await log(meera, "member_joined", "Meera Nair joined the trip")
await log(asha, "guest_added", `Asha Sharma added guest "Kiran (guest)"`)
await log(asha, "expense_added", `Asha Sharma added "Beach hotel (3 nights)" (Rs.6,000)`)
await log(ravi, "expense_disputed", `Ravi Kumar disputed "Water sports": Price was Rs.2500, not Rs.3000`)

await Message.create([
    { trip: trip._id, sender: asha._id, senderName: asha.name, text: "Welcome to the Goa trip group! 🏖️" },
    { trip: trip._id, sender: ravi._id, senderName: ravi.name, text: "Added the lunch bill, please confirm" },
    { trip: trip._id, sender: meera._id, senderName: meera.name, text: "Will do tonight" },
])
await Notification.create([
    { user: meera._id, trip: trip._id, type: "tagged", message: 'Ravi Kumar tagged you in "Scooter rental" (Rs.1,200). Please confirm or dispute it', link: `/trips/${trip._id}/expenses?open=${scooter._id}` },
    { user: asha._id, trip: trip._id, type: "disputed", message: 'Ravi Kumar disputed "Water sports": Price was Rs.2500, not Rs.3000', link: `/trips/${trip._id}/expenses` },
])

console.log("\nSeed finished. Demo accounts (password for all: demo123)")
console.log("  asha@demo.com   (trip ADMIN)")
console.log("  ravi@demo.com   (member)")
console.log("  meera@demo.com  (member)\n")
await mongoose.disconnect()
