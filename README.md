# TaskEarn — Micro-task earning platform

A full-stack task-and-earn platform: users complete real tasks (surveys, app
installs, partner offers) posted by advertisers and get paid out via
EasyPaisa, JazzCash, or bank transfer. Includes a full admin panel for
payment approval, task management, and content control.

**This is a real micro-task / CPA platform, not an investment or HYIP
product.** Payouts come from real advertiser-funded tasks, never from other
users' deposits. Keep it that way — see "Staying compliant" below.

---

## Stack

- **Backend:** Node.js, Express, PostgreSQL (`pg` driver), JWT auth
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Database schema:** documented in `backend/prisma/schema.prisma` (Prisma
  is used as schema documentation / future ORM; see note below)

---

## Project structure

```
taskearn-platform/
├── backend/
│   ├── prisma/schema.prisma       # Data model (source of truth for the DB shape)
│   ├── prisma/manual_migration.sql # Raw SQL equivalent (sandbox-applied)
│   ├── src/
│   │   ├── controllers/           # Route handlers
│   │   ├── routes/                # Express routers
│   │   ├── middleware/            # Auth, file upload
│   │   ├── services/walletService.js  # All money movement goes through here
│   │   ├── utils/                 # auth helpers, seed script
│   │   └── index.js               # App entry point
│   └── .env                       # Local config (DB url, JWT secret, etc.)
└── frontend/
    ├── app/                       # Pages: home, about, plan, dashboard,
    │                               # blog, login, register, contact, admin/*
    ├── components/                # Shared UI + dashboard/admin components
    └── lib/                       # API client, auth context, types
```

---

## Running locally

### 1. Database

```bash
createdb taskearn_db   # or use the SQL in backend/prisma/manual_migration.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, etc.
npx prisma generate         # generates the Prisma client (needs network access)
npx prisma migrate dev      # creates tables from schema.prisma
npm run seed                # creates admin user + sample categories/tasks
npm run dev                 # http://localhost:4000
```

> **Note on Prisma:** the code in this repo currently talks to Postgres
> directly via the `pg` package (see `src/db/pool.js` and the controllers),
> because the sandbox this was built in couldn't reach Prisma's engine
> binary CDN. `prisma/schema.prisma` is kept up to date as the canonical
> schema. If you'd like to switch the data-access layer to
> `@prisma/client`, the schema is ready — you'd swap the raw SQL queries in
> `src/controllers/*.js` for Prisma client calls. Either approach works
> against the same database.

Default admin login after seeding:
```
admin@taskearn.local / Admin@12345
```
**Change this password immediately after first login.**

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm run dev                         # http://localhost:3000
```

---

## How money moves through the system

- **`walletService.js`** is the only place wallet balances change. Every
  credit/debit is wrapped in a DB transaction with a row lock
  (`SELECT ... FOR UPDATE`) and writes an append-only `LedgerEntry`, so the
  wallet balance is always reconstructable from the ledger and concurrent
  requests can't double-spend.
- **Deposits** (EasyPaisa/JazzCash/bank): user submits amount + transaction
  ID + optional screenshot → status `PENDING` → admin manually verifies
  against their own EasyPaisa/JazzCash/bank account → approves (credits
  wallet) or rejects.
- **Withdrawals**: requested amount is immediately reserved (debited) from
  the wallet so it can't be double-withdrawn while pending. Admin approves →
  sends the real payment manually via EasyPaisa/JazzCash/bank → marks
  `PAID`. If admin rejects, the reserved amount is refunded automatically.
- **Task rewards (manual)**: user submits proof → `PENDING` → admin reviews
  → approval credits the wallet with the task's reward amount.
- **Task rewards (CPA network)**: see below.

All of this was tested end-to-end against a live Postgres database during
development (register → deposit → approve → balance update → withdraw →
reject → refund → task submit → approve → balance update), not just written
and assumed to work.

---

## CPA / offerwall network integration

`POST /api/tasks/cpa/postback` is a server-to-server endpoint a CPA network
calls when a user completes one of their offers. It's secured by a shared
secret (`CPA_POSTBACK_SECRET` in `.env`) and is idempotent (won't double-pay
if called twice for the same user+task).

**Before wiring this up to a real network**, please read their terms
carefully. Most CPA/offerwall networks (OGAds, AdGate, MyLead, etc.)
explicitly **prohibit incentivized traffic** — i.e., paying users cash for
completing offers — because it's the most common form of fraud on their
platforms. Getting approved as a publisher, and staying approved, depends
on you being upfront with the network about your model and following their
specific incentive policies (some allow incentivized traffic for certain
offer types, most don't). This is a real business relationship between you
and the network; nothing here can substitute for that.

---

## Staying compliant

A few hard lines worth keeping in place as you extend this:

- **Never promise a fixed "return" on a deposit.** Users should only ever
  earn from completing actual tasks/offers funded by actual advertisers.
- **Never pay one user's reward from another user's deposit.** Task rewards
  should map to real advertiser/CPA-network revenue, not platform float.
- **Keep manual review in the loop** for anything that isn't verified by a
  real, authenticated postback from a payment gateway or CPA network.
  Self-reported "I completed it" proof should be checked by a human before
  money moves.
- If you ever add EasyPaisa/JazzCash merchant API integration for automatic
  deposit verification, get the relevant merchant agreements in place first
  — `.env` has placeholders for this but no live integration is wired up.

---

## What's built vs. what's a stub

**Fully built and tested (live Postgres + live API calls during dev):**
auth, wallet/ledger, manual task submission + review, CPA postback handler,
manual deposits + admin review, withdrawals (reserve/approve/reject/refund/
paid), admin dashboard stats, user status management, task CRUD, blog CMS,
contact form, payment method configuration.

**Stubbed / needs your own setup to go live:**
- EasyPaisa/JazzCash/bank **merchant API** auto-verification (currently
  manual-only by design — see `.env` placeholders)
- Actual CPA network approval + postback URL configuration (the endpoint is
  ready; the business relationship with a network is not something this
  code can create)
- Email sending (verification, password reset) — not implemented
- Production secrets, HTTPS, rate limiting beyond the basic auth limiter,
  and a real file-storage backend for uploads (currently local disk)
