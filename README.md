# Invoicy

Invoicy is a full‑stack invoice management system.

- Frontend: Next.js 15 (App Router) + Tailwind CSS + Zustand
- Backend: NestJS 11 + Prisma + PostgreSQL (Neon recommended)
- Payments: Stripe (subscription + per‑invoice via Connect)
- Deploy: Frontend on Netlify, Backend on Railway


## Monorepo structure

- `backend/` — NestJS API and Prisma schema/migrations
- `frontend/` — Next.js app (public site + dashboard)
- `DEPLOYMENT.md` — step‑by‑step production deploy guide (Railway + Netlify)


## Quick start (local)

Prereqs: Node 18.18+, PNPM/NPM, PostgreSQL (or Neon). New terminal tabs for frontend and backend.

1) Backend
- Copy `backend/.env.example` to `backend/.env` and fill values. Minimum required:
  - `DATABASE_URL`, `DIRECT_URL`
  - `JWT_SECRET`
  - Optional: SMTP envs if you want email sending
- Install and run:
  ```bash
  npm install
  npm run prisma:migrate
  npm run db:seed
  npm run start:dev
  ```
  Backend runs at `http://localhost:3001` (API base `http://localhost:3001/api`).

2) Frontend
- Create `frontend/.env.local`:
  ```bash
  NEXT_PUBLIC_API_URL=http://localhost:3001/api
  # NEXT_PUBLIC_API_TIMEOUT_MS=15000   # optional
  ```
- Install and run:
  ```bash
  npm install
  npm run dev
  ```
  Open `http://localhost:3000`.


## Authentication flow

- Email/password only. Social logins (Google/GitHub) have been removed from `frontend/src/app/(auth)/login/page.tsx`.
- Registration requires email verification. Until verified, protected routes redirect to `'/email-verification'`.
- Auth token storage:
  - Access token stored in sessionStorage by default, or localStorage when "Remember me" is checked.
  - A non‑HttpOnly cookie `access_token` is synced by the frontend for middleware checks on the edge.

Key files:
- Frontend store: `frontend/src/lib/stores/auth-store.ts`
- API client: `frontend/src/lib/api-client.ts`
- Middleware: `frontend/src/middleware.ts`


## Route protection and middleware

- Public routes include: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/email-verification`, `/public`, `/invoice`, `/payment`.
- Protected areas: `/dashboard/**`, `/clients/**`, `/invoices/**`, `/payments/**`, `/reports/**`, `/settings/**`, `/admin/**`.
- Middleware checks the `access_token` cookie and redirects unauthenticated users from protected pages to `/login?redirect=<path>`.
- Verified‑email enforcement: logged‑in, non‑verified users are redirected to `/email-verification` for non‑public pages.

Note: The project currently contains two middleware files (`frontend/middleware.ts` and `frontend/src/middleware.ts`). Production builds use `frontend/src/middleware.ts`. The homepage (`/`) is explicitly allowed as public there.


## Stripe payments

- Subscription (SaaS): Checkout + Billing Portal
- Invoice payments (Stripe Connect) for individual users
- Fallback verification flow is implemented for public invoice checkout:
  - Backend appends `session_id` to `success_url`
  - Endpoint: `POST /public/invoices/:shareId/payments/stripe/verify`
  - Frontend public invoice page auto‑verifies on return (`paid=1 & session_id`) and refreshes the invoice


## Production deployment (summary)

- Backend (Railway): set env vars (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, optional SMTP), start command `npm run start` (runs migrations/seed then starts app)
- Frontend (Netlify): set `NEXT_PUBLIC_API_URL` to your Railway URL (`https://<railway-app>.up.railway.app/api`), build with `npm run build`

See `DEPLOYMENT.md` for the full, tested workflow, including Neon DB notes and troubleshooting.


## Common issues

- Home page redirects to login on production:
  - Fixed by allowing `/` as a public route in `frontend/src/middleware.ts` and ensuring the match for `/` is exact, not a prefix. Re‑deploy the frontend.
  - If it still happens, clear local storage/cookies for `access_token` and hard‑refresh.
- CORS blocked:
  - Add your Netlify site origin to `FRONTEND_ORIGINS` in backend env.
- Emails not sending:
  - Configure SMTP or use SendGrid/Brevo, and set `EMAIL_PROVIDER` and related envs in the backend.


## Scripts

- Backend: `start:dev`, `prisma:migrate`, `db:seed`
- Frontend: `dev`, `build`, `start`


## License

Private project for demonstration purposes.
