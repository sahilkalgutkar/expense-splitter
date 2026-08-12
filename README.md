# SplitEasy

A mini Splitwise: group expense tracking, settle-up math, and recurring bills for roommates and trips.

- **Frontend**: React + TypeScript, Vite, Tailwind, React Hook Form + Zod, TanStack Query
- **Backend**: NestJS, PostgreSQL, Prisma ORM, JWT auth (access + rotating refresh tokens), Resend email invites
- **Settle-up**: a greedy min-cash-flow algorithm (two max-heaps, largest creditor ↔ largest debtor) that reduces
  a group's tangled debts to a minimal set of suggested payments — see
  [`backend/src/settlements/settle-up.util.ts`](backend/src/settlements/settle-up.util.ts).

## Project structure

```
backend/    NestJS API (Prisma + PostgreSQL)
frontend/   React + Vite SPA
docker-compose.yml   local PostgreSQL for development
render.yaml           Render blueprint for deploying the backend
```

## Local development

**Prerequisites**: Node.js 22+, Docker.

1. Start Postgres:
   ```bash
   docker compose up -d
   ```
2. Backend:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma migrate dev
   npm run start:dev
   ```
   API runs at `http://localhost:3000/api`. Without a `RESEND_API_KEY`, invite emails are logged to the
   console instead of sent, so invites still work end-to-end in dev.
3. Frontend (in a second terminal):
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```
   App runs at `http://localhost:5173`.

Run the backend test suite (settle-up algorithm + split math) with `npm test` from `backend/`.

## Deploying

- **Database**: create a free [Neon](https://neon.tech) Postgres project and copy its connection string.
- **Backend (Render)**: this repo includes a `render.yaml` blueprint. In the Render dashboard, "New +" →
  "Blueprint", point it at this repo, and it will build `backend/Dockerfile`. Either let Render provision
  its own free Postgres (already wired into `render.yaml`) or delete the `databases:` block and set
  `DATABASE_URL` manually to your Neon connection string. Set `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, and
  `FRONTEND_URL` (your Vercel URL) in the Render dashboard — they're marked `sync: false` so they aren't
  committed to the repo.
  Railway works the same way without a config file: create a service from this repo with root directory
  `backend`, it detects the Dockerfile automatically, and env vars are set in the Railway dashboard.
- **Frontend (Vercel)**: import this repo, set the project root to `frontend/`, and set `VITE_API_URL` to
  your deployed backend's URL (e.g. `https://your-api.onrender.com/api`). `vercel.json` handles the SPA
  rewrite so client-side routes work on refresh.

After deploying, update the backend's `FRONTEND_URL` to the live Vercel URL (needed for CORS and invite
links) and redeploy.
