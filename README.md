# SplitEasy

A mini Splitwise: group expense tracking, settle-up math, and recurring bills for roommates and trips.

I built the backend with NestJS, Prisma, and PostgreSQL, with JWT access tokens paired with rotating
refresh tokens — hashed with SHA-256 and never stored raw, so a database leak alone can't be replayed —
and Resend for invite emails. For settle-up, I wrote a greedy min-cash-flow algorithm instead of
brute-forcing the NP-hard optimal solution: two max-heaps, largest creditor paired with largest debtor
each round, collapsing a group's tangled debts into a minimal set of suggested payments. See
[`backend/src/settlements/settle-up.util.ts`](backend/src/settlements/settle-up.util.ts).

On the frontend I used React + TypeScript, Vite, and Tailwind, with React Hook Form + Zod for forms and
TanStack Query for server state, including a single axios interceptor that handles silent access-token
refresh with single-flight de-duplication so concurrent 401s don't trigger a refresh stampede.

Both sides are covered by real test suites — service-level unit tests with Prisma mocked, plus an
end-to-end suite that drives the full HTTP stack against a real Postgres database, not mocks — wired
into CI via GitHub Actions on every push.

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

Run the backend unit tests with `npm test` from `backend/`, or the full e2e suite (needs the Postgres
container running) with `npm run test:e2e`. Frontend tests run with `npm run test` from `frontend/`.

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

## License

[MIT](LICENSE)
