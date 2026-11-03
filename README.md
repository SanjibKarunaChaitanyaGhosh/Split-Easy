# SplitEasy — trip & event expense splitter with group chat

A MERN stack web app (MongoDB, Express, React 18 + Vite, Node 18+) for a college project.
Friends create a trip, each person adds what **they** spent and **tags** who shares it, the tagged
people **confirm or dispute** it, and the app works out who owes whom. Every trip has a live group
chat, edit requests, an activity log, settle-up with recorded payments, and a downloadable PDF bill.

```
spliteasy/
  server/     Express + Mongoose API, Socket.io, PDF, e-mail   (port 4000)
  client/     React app (plain CSS)                             (port 5173)
  docs/       Architecture, ER description, assumptions (for the college report)
```

## 1. Prerequisites

- **Node.js 18 or newer**
- **MongoDB**: either installed locally, or a free **MongoDB Atlas** cluster
- (optional) an SMTP account for real invitation e-mails — the app works without it

## 2. Setup and run (3 steps)

### Step 1 — backend

```bash
cd server
npm install
cp .env.example .env        # Windows: copy .env.example .env
# edit .env: set MONGO_URI and Jwt_SECRET_KEY
npm run seed                # optional: creates demo users + a demo trip (EMPTIES the database first)
npm run dev                 # http://localhost:4000
```

You should see `Mongo_URL Database Connected successfully....` and `Server is running on http://localhost:4000`.

### Step 2 — frontend (second terminal)

```bash
cd client
npm install
npm run dev                 # http://localhost:5173
```

### Step 3 — open http://localhost:5173

The Vite dev server forwards `/api`, `/uploads` and the websocket to the backend, so no CORS or URL
setup is needed in development.

## 3. Demo accounts (after `npm run seed`)

| Email | Password | Role in the demo trip "Goa Beach Trip" |
|---|---|---|
| asha@demo.com | demo123 | **Admin** (creator) |
| ravi@demo.com | demo123 | Member |
| meera@demo.com | demo123 | Member (has an expense waiting for her confirmation) |

The demo trip also has a guest ("Kiran (guest)"), confirmed, pending and disputed expenses, a recorded
payment, an open edit request, chat messages and notifications. Open two browsers (or one normal and
one private window) to see the real-time chat between two users.

## 4. Environment variables

**server/.env**

| Variable | Required | Meaning |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/spliteasy` |
| `Jwt_SECRET_KEY` | yes | long random text used to sign login tokens |
| `PORT` | no | default `4000` |
| `CLIENT_URL` | no | address of the React app (CORS + links inside e-mails). Default `http://localhost:5173` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | e-mail invitations. If `SMTP_HOST` is empty the app shows a **copyable link** (WhatsApp / mailto) instead |
| `AUTH_RATE_LIMIT_MAX` | no | login/register attempts per IP per 15 min (default 30) |

**client/.env** (copy `client/.env.example`):

| Variable | Meaning |
|---|---|
| `VITE_PROXY_TARGET` | address of the backend, must match `PORT` in `server/.env` (default `http://localhost:4000`) |
| `VITE_API_URL` | **leave empty** in development. Only for an API hosted on another address |

Restart `npm run dev` after changing any `.env` file.

### Troubleshooting
- **"Cannot reach the server. Is the backend running?"** — the backend is not running, or `VITE_PROXY_TARGET` does not match the
  backend `PORT`, or `VITE_API_URL` is set to something wrong (e.g. `https://localhost:5173/api`). Empty it and restart the client.
- **`ERR_SSL_PROTOCOL_ERROR`** — a URL uses `https://` for a local address. Local addresses are `http://`.

### MongoDB Atlas (no local install)
1. Create a free cluster at mongodb.com/atlas → **Database Access**: add a user → **Network Access**: add your IP.
2. **Connect → Drivers**: copy the string into `MONGO_URI`, e.g. `mongodb+srv://USER:PASS@cluster.mongodb.net/spliteasy`.

## 5. Features

**Accounts** — register / login (bcrypt + JWT, 7 days), every page except login / register / invite-preview needs login,
after login you are sent back to where you were going (e.g. an invite link).

**Trips & roles** — create a trip (name, destination, dates, description, emoji). Creator = **ADMIN**; others = **MEMBER**.
Participants are registered users or **guests** (shown with a *Not registered* badge, included in the split).
Admin: edit trip, invite/remove people, add guests, edit **any** expense (with a reason), resolve edit requests, regenerate/disable the
invite link, **lock** the trip for final settlement. Members: add their own expenses, edit/delete only their own (rules below; **only the person who added an expense can delete it**),
confirm/dispute, raise edit requests, chat, download the PDF.

**Invitations** — (A) link `/join/<token>`: anyone sees a preview (trip, destination, admin, member count), registers or logs in,
and joins automatically. (B) by e-mail (admin, or members if the admin allows it): creates an invitation, sends a mail with the
link, falls back to a copyable link when SMTP is missing; the invited person sees a *"You've been invited"* banner and accepts in
one click; the admin sees pending invitations with **resend / cancel**. A guest can be **merged** into the real user when
they sign up (expenses, tags and payments move; nobody is counted twice).

**Expenses** — title, amount (₹), category, date, paid by, notes, place, optional GPS (browser geolocation + "view on map"),
optional bill photo (max 2 MB). Split mode **Tagged people** (chips, *Select all*) or **Whole trip**.
*Confirmation workflow:* tagged people (and the payer) confirm or dispute (reason required). Status = pending / confirmed / disputed.
Only **confirmed** expenses count in balances (toggle *Include pending* to preview; disputed never count). Guests cannot confirm,
so the admin answers for them. *Editing:* the creator can edit while pending/disputed; editing resets confirmations and notifies
tagged people. Others cannot edit; the admin can edit any expense but must give a **reason**. Every edit is stored in a
**version history** (who, when, why, old → new). **Delete = only the person who added the expense** (not other members, not even the admin); deleted expenses stay in the activity log.

**Edit requests & history** — any member raises a request (who, why, what to correct); the admin or the expense creator marks it
Resolved / Rejected with a note. Sidebar: Overview, Expenses, People & invites, Chat, Edit requests, Activity log, Settle up
(collapses to a scrollable tab bar on mobile). The **Activity log** is an automatic timeline of everything.

**Chat** — real-time (Socket.io, authenticated with the same JWT), messages saved in MongoDB, latest 50 + *Load earlier*,
"typing…" indicator, unread badge, auto-scroll, share an expense into the chat as a card, 1000-character limit, HTML escaped,
rate limited.

**Settle up** — per person: paid, share, balance; fewest-payments suggestions; **Mark as paid** records a payment that reduces
balances; payment history visible to all members; rounding remainder handled so shares always add up exactly; **lock** trip.

**PDF bill** — trip details, itemised table (date, item, category, place, paid by, split among, amount, status), totals, each
person's share and balance, settle-up instructions, generated date and page numbers; the table breaks across pages correctly.
Amounts are printed as "Rs." because the built-in PDF font has no ₹ glyph.

**Also** — in-app notifications (bell, live), toasts, confirm dialogs, loading skeletons, empty states, ₹ with Indian grouping,
en-IN dates, labelled inputs and keyboard-friendly controls, helmet + rate limiting + input sanitising.

## 6. API (all under `/api`, JSON; protected routes need `Authorization: Bearer <token>`)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/register`, `/auth/login` | public | create account / log in → `{token, user}` |
| GET | `/auth/me` | login | current user |
| GET | `/trips` | login | my trips |
| POST | `/trips` | login | create trip (creator becomes admin) |
| GET | `/trips/join/:token` | **public** | invite preview |
| POST | `/trips/join/:token` | login | join through an invite link or e-mail invitation |
| GET | `/trips/:id` | member | trip details |
| PUT / DELETE | `/trips/:id` | admin | edit / delete trip |
| POST | `/trips/:id/lock` | admin | lock / unlock `{locked}` |
| POST | `/trips/:id/invite-link` | admin | `{action: regenerate\|enable\|disable}` |
| POST | `/trips/:id/guests` | admin | add guest |
| POST | `/trips/:id/guests/:gid/merge` | admin | merge guest into a member |
| DELETE | `/trips/:id/participants/:pid` | admin | remove participant |
| POST | `/trips/:id/invitations` | admin (or members if allowed) | invite by e-mail |
| GET | `/trips/:id/invitations` | admin | list invitations |
| POST | `/trips/:id/invitations/:iid/resend` | admin | resend |
| DELETE | `/trips/:id/invitations/:iid` | admin | cancel |
| GET | `/invitations/mine` | login | invitations for my e-mail |
| POST | `/invitations/:iid/accept` | login | accept in one click |
| GET / POST | `/trips/:id/expenses` | member | list / add (multipart: bill photo) |
| GET / PUT / DELETE | `/trips/:id/expenses/:eid` | member / creator or admin / **creator only** | one / edit / delete |
| GET | `/trips/:id/expenses/:eid/history` | member | version history |
| POST | `/trips/:id/expenses/:eid/confirm` · `/dispute` | tagged person (admin for guests) | answer |
| GET / POST | `/trips/:id/requests` | member | edit requests |
| PUT | `/trips/:id/requests/:rid` | admin or expense creator | resolve / reject |
| GET / POST | `/trips/:id/payments` | member | payment history / mark as paid |
| DELETE | `/trips/:id/payments/:pid` | recorder or admin | delete payment |
| GET | `/trips/:id/summary?includePending=` | member | balances + settlements |
| GET | `/trips/:id/activity` | member | activity log |
| GET / POST | `/trips/:id/messages` · `/messages/unread` · `/messages/read` | member | chat REST part |
| GET | `/trips/:id/pdf` | member | PDF bill |
| GET | `/notifications` · POST `/notifications/read-all` · PATCH `/notifications/:nid/read` | login | notifications |

Socket.io events: client → `trip:join`, `trip:leave`, `typing`, `message:send`; server → `message:new`, `typing`, `notification`.
Permissions (member / admin / creator) are enforced on the **server** in middleware (`tripAccess`, `adminOnly`, `notLocked`)
and in the controllers, never only in the UI.

## 7. Tests

```bash
cd server && npm test        # unit tests for the balance + settlement logic (9 tests)
```
Includes the **₹1000 lunch + ₹2000 dinner with 3 people** example: total ₹3000, each share ₹1000, the dinner payer gets ₹1000 back,
the lunch payer owes nothing, the third person owes ₹1000.

During development the whole app was also driven end to end: 136 API checks (permissions, confirmation flow, invitations, merge,
uploads, PDF, chat over sockets) and 63 browser checks (several users at the same time) — all passing. These ran against a
MongoDB-compatible server, so please run through the demo once on your own MongoDB before presenting.

## 8. Phase 2 — "Continue with Google" (not built, prepared)

- `User.password` is already optional and the login controller refuses password login for accounts without one.
- Where to add it: `server/models.js/user.js` has a comment where `googleId` goes.
1. Create an OAuth client in Google Cloud Console (Web application) and copy the **Client ID**.
2. `cd server && npm i google-auth-library`; add `GOOGLE_CLIENT_ID` to `.env`.
3. Add `googleId: { type:String, unique:true, sparse:true }` to the user schema.
4. New route `POST /api/auth/google` — verify the token:
   ```js
   import { OAuth2Client } from 'google-auth-library'
   const ticket = await new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
     .verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID })
   const { sub, email, name } = ticket.getPayload()
   // find user by googleId or email (link them), else create it, then return the same {token, user} as /auth/login
   ```
5. In the React login page load Google Identity Services and send the returned `credential` to that route.

## 9. Assumptions

See `docs/ARCHITECTURE.md` (section 5) for the full list.
