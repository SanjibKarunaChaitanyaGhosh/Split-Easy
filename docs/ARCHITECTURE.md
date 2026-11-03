# SplitEasy — architecture, data model and assumptions (for the college report)

## 1. Architecture

```
 Browser (React 18 + Vite)                      Server (Node 18, Express)                     MongoDB
 ┌───────────────────────────┐   HTTP / JSON    ┌──────────────────────────────┐   Mongoose   ┌────────────┐
 │ Pages, TripLayout (state) │ ───────────────► │ routes → middleware → controllers │ ────────► │ 9 collections│
 │ api.js (axios + JWT)      │ ◄─────────────── │ auth, tripAccess, adminOnly,  │            └────────────┘
 │ socket.js (socket.io)     │   WebSocket      │ notLocked, upload, sanitize   │
 └───────────────────────────┘ ◄──────────────► │ socket.js (rooms per trip/user)│ ─► Nodemailer (SMTP, optional)
                                                 │ utils/balance.js (pure money logic) │ ─► pdfkit (PDF bill)
                                                 └──────────────────────────────┘
```

**Request flow (adding an expense).** The React form sends `multipart/form-data` (because of the bill photo) →
`auth` verifies the JWT and loads the user → `tripAccess` loads the trip and checks the user is a member → `notLocked` →
`multer` stores the photo (≤ 2 MB, images only) → the controller validates every field, builds the list of people who must
confirm, saves the expense, writes the activity log and sends notifications → the client reloads the list and the summary.

**Layers on the server**

| Folder | Responsibility |
|---|---|
| `routes/` | which URL goes to which controller, which middleware runs first |
| `middleware/` | `auth` (JWT), `tripAccess` / `adminOnly` / `notLocked` (permissions), `upload`, `sanitize`, `rateLimit`, `errorHandler` |
| `controllers/` | business rules (confirmation workflow, edit rules, invitations, merge, payments …) |
| `models.js/` | Mongoose schemas |
| `utils/` | `balance.js` (pure money logic, unit-tested), `pdf.js`, `mailer.js`, `chat.js`, `notify.js`, `activity.js` |
| `socket.js` | real-time chat; sockets are authenticated with the same JWT |

**Why the permission checks are on the server.** A button hidden in React protects nothing. Membership, admin-only actions,
"only the creator may edit while pending, only the creator may delete", "a locked trip is read-only" and the guest-confirmation rule are all checked in
middleware / controllers, and the API also returns flags (`canEdit`, `canDelete`, `reasonRequired`) so the UI only shows what is allowed.

**Real-time.** Each socket joins `user:<id>` (notifications) and, after the server verifies membership, `trip:<id>`.
`message:send` runs the same `createMessage()` as the REST route (trim, 1000 chars, escape HTML, rate limit, save) and broadcasts `message:new`.

**Money logic (`utils/balance.js`).** All amounts are integer **paise**. An expense is split equally between its people; the
remaining paise are handed out so that the shares always add up exactly and nobody always gets the extra paisa (the person with
the fewest extras so far receives it). Net balance = paid − share + payments sent − payments received. Settlement: repeatedly
make the biggest debtor pay the biggest creditor — never more than (people − 1) payments.

## 2. Data model (ER-style description)

```
USER 1───< TRIP.participants (embedded)  >───1 TRIP
TRIP 1───< EXPENSE        TRIP 1───< PAYMENT       TRIP 1───< EDITREQUEST
TRIP 1───< INVITATION     TRIP 1───< ACTIVITY      TRIP 1───< MESSAGE
USER 1───< NOTIFICATION   EXPENSE 1───< EDITREQUEST (optional)
```

| Collection | Key fields | Notes / indexes |
|---|---|---|
| **user** | name, email (unique, lower-case), password (hash, optional → Google later) | |
| **trip** | name, destination, startDate, endDate, description, emoji, **admin** → user, **participants[ ]**, inviteToken (unique), inviteEnabled, membersCanInvite, locked | index `participants.user` |
| ↳ participant (embedded) | _id, name, **user?** (null = guest), email, role (admin/member), lastReadChat | expenses/payments point to the participant `_id`, not to the user, so guests work |
| **invitation** | trip, email, token (unique), status (pending/accepted/cancelled), invitedBy, acceptedBy | index (trip,status), (email,status) |
| **expense** | trip, createdBy, createdByName, **paidBy** → participant, title, amount, category, date, notes, place, location{lat,lng}, billImage, splitMode (tagged/whole), splitAmong[ ] → participants, **confirmations[ ]**{participant,status,reason,actedBy,at}, status, **versions[ ]**{by,byName,at,reason,changes[ ]} | index (trip,date) |
| **editrequest** | trip, expense?, requestedBy, reason, correction, status (open/resolved/rejected), resolvedBy, resolvedNote, resolvedAt | index (trip,createdAt) |
| **payment** | trip, from → participant, to → participant, amount, date, note, recordedBy | index (trip,date) |
| **activity** | trip, actor, actorName, type, message, meta | index (trip,createdAt) |
| **message** | trip, sender, senderName, text (≤1000, escaped), expense{id,title,amount}? | index (trip,createdAt) |
| **notification** | user, trip, type, message, link, read | index (user,createdAt) |

## 3. Expense life-cycle

```
add ─► status "pending"  (creator is auto-confirmed; every other tagged person + the payer must answer)
        ├─ everyone confirms ───────────────► "confirmed"  (counts in balances)
        ├─ anyone disputes (reason) ────────► "disputed"   (never counted; creator is notified)
        └─ creator edits (while pending/disputed) or admin edits (reason required)
                 └─ version stored, all confirmations reset, tagged people notified ─► "pending"
```

## 4. Security summary

bcrypt (10 rounds) password hashes, never returned · JWT 7 days · helmet headers · CORS only for `CLIENT_URL` ·
rate limit on login/register · request body/query checked for `$` operators (NoSQL injection) · ObjectIds validated (no crash
on bad ids) · uploads: images only, 2 MB, random file names · chat text escaped · secrets only in `.env`.

## 5. Assumptions made

1. **Whole-trip split** is calculated over *all current participants*; people who join later share earlier whole-trip expenses
   too, but only the people present when an expense was added had to confirm it.
2. **Who must confirm:** every tagged person plus the payer (if different). Whoever created / edited the expense is confirmed automatically.
   The admin answers on behalf of guests.
3. **Locked trip** = no new expenses, edits, deletes, confirmations, guests, invitations or trip edits; *recording payments still works*
   (that is the point of a final settlement). The admin can unlock.
4. **Removing a participant** is refused when they appear in any expense, payment, or the trip has whole-trip expenses (it would
   silently change everyone's balances). Guests should be **merged** into the real user instead.
5. **Only the person who added an expense can delete it** (the admin can edit it with a reason, but not delete it). Expenses are hard-deleted; a line stays in the activity log. Bill photos are deleted from disk with them.
6. **Members cannot add guests** (admin only, as specified). Members can invite by e-mail only if the admin switches that on.
7. **E-mail invitations use their own token**, so regenerating or disabling the trip's invite link does not break invitations
   that are already sent. Without SMTP the app returns the link to copy / share.
8. **Greedy settlement** (biggest debtor pays biggest creditor) is used: at most n−1 payments, not guaranteed to be the global minimum
   (that problem is NP-hard in general).
9. **Bill photos** are saved on the server disk under `/uploads` with random names and can be opened by anyone who has the URL.
   For production use private object storage with signed links.
10. **Chat rate limit** is in memory (one server process). Use a shared store such as Redis if the API is scaled out.
11. **The JWT is kept in `localStorage`** (simple for a college project); an HttpOnly cookie is safer against XSS.
12. **PDF** uses "Rs." because the built-in PDF fonts lack the ₹ glyph (embed a ₹-capable font to print the symbol).
13. **Notifications** are in-app only (bell + live update through the socket); no push or e-mail notifications.
14. **Google login is Phase 2** and not implemented; the code is structured for it (see README §8).
15. Folder names follow the author's own convention (`models.js/` for models, `controllers/`, `routes/`, `middleware/`, ES modules,
    env names `MONGO_URI`, `PORT`, `Jwt_SECRET_KEY`); the spec's `express-async-errors` + central error handler replaces per-controller try/catch.
16. **Test environment:** automated tests were run against a MongoDB-compatible server, not MongoDB itself.
