# Invoicy Production Deployment Guide

This guide explains how to deploy the Invoicy app with:

- Neon (PostgreSQL) for DB
- Railway for the backend (NestJS + Prisma)
- Netlify for the frontend (Next.js)

The repository is a mono-repo with two projects:

- backend/ (NestJS + Prisma)
- frontend/ (Next.js)

## 1) Database: Neon

1. Create a Neon project and a database.
2. Create two connection strings:
   - Pooled (for runtime): append `?sslmode=require&pgbouncer=true&connection_limit=1&connect_timeout=15`
   - Direct (for migrations): append `?sslmode=require&connect_timeout=15`
3. Copy these into Railway service environment variables:
   - `DATABASE_URL` = pooled connection string
   - `DIRECT_URL` = direct connection string

Notes
- Prisma `schema.prisma` is already configured with `directUrl` for migrations.
- Neon works best with PgBouncer (pooled) for app runtime, and direct connections for migrations.

## 2) Backend: Railway

The backend is prepared with production defaults:
- Helmet, compression, CORS, and rate limiting
- Health check: `GET /api/health`
- Prisma migrations and seed run as part of `npm start` via the `prestart` script
- Graceful shutdown hooks enabled for Prisma

### Environment Variables (Railway)
Set the following in your Railway backend service:

Required
- `DATABASE_URL` (Neon pooled)
- `DIRECT_URL` (Neon direct, non-pooled)
- `JWT_SECRET` (a strong random string)
- `PORT` (Railway sets this automatically; keep it if provided)

Recommended
- `FRONTEND_ORIGINS` (comma-separated list, e.g. `https://<your-netlify-site>.netlify.app,http://localhost:3000`)
- `ADMIN_EMAIL` (for seed; default `admin@invoicy.com`)
- `ADMIN_PASSWORD` (for seed; default `admin@gmail.com`)
- `RATE_LIMIT_WINDOW_MS` (default 900000)
- `RATE_LIMIT_MAX` (default 300)

Optional (email)
- `EMAIL_PROVIDER` = SMTP or SENDGRID
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, etc.

### Start Command (Railway)
- Build: Railway will run `npm install` and may run `npm run build` automatically based on platform. The backend `start` script runs the compiled app.
- Start command: `npm run start`
  - This triggers `prestart` first: `prisma migrate deploy && prisma db seed && nest build`
  - Then `node dist/main`

### Seed During Migration
- Seed is idempotent and runs on every start.
- Admin user is upserted based on `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Default public config is created if missing.

## 3) Frontend: Netlify

The frontend is a Next.js 15 app configured for Netlify:
- `netlify.toml` uses `@netlify/plugin-nextjs`
- Security headers & long-term caching for `/_next/static/*`
- `next.config.ts` enables strict mode, disables `X-Powered-By`, turns on compression

### Environment Variables (Netlify)
Set in Netlify Site settings -> Build & deploy -> Environment:
- `NEXT_PUBLIC_API_URL` = `https://<your-railway-backend>.up.railway.app/api`
- Optionally adjust `NEXT_PUBLIC_API_TIMEOUT_MS` (default 15000)

### Build Settings (Netlify)
- Build command: `npm run build`
- Publish directory: `.next`
- Node version: `>=18.18.0` (already set in `package.json` engines)

## 4) Local Development

Backend
- Create `backend/.env` from `backend/.env.example`
- Ensure local Postgres if not using Neon locally
- Commands:
  - `npm install`
  - `npm run prisma:migrate` (dev) or `npm run migrate:deploy` (apply migrations)
  - `npm run db:seed`
  - `npm run start:dev`

Frontend
- Create `frontend/.env.local` from `frontend/.env.local.example`
- Commands:
  - `npm install`
  - `npm run dev`

## 5) Notes on File Uploads

The backend currently serves uploads from `backend/uploads/` which is ephemeral on PaaS providers. For production:
- Configure S3 or a compatible object storage.
- Set the bucket credentials in env and update the storage implementation (code has placeholders for AWS envs).

## 6) Troubleshooting

- 500 on startup: ensure `DIRECT_URL` and `DATABASE_URL` are properly set in Railway.
- CORS blocked: add your Netlify domain to `FRONTEND_ORIGINS` in the backend env.
- Prisma timeouts: increase `connect_timeout` values and verify Neon branch is awake.
- Seed not applying: check Railway logs; confirm `ADMIN_EMAIL`/`ADMIN_PASSWORD` are set. Seed runs during `npm start`.

## 7) What we changed
- Prisma `datasource` now includes `directUrl` for Neon.
- Idempotent seed at `backend/prisma/seed.mjs` and wired via `"prisma": { "seed": "node prisma/seed.mjs" }`.
- `backend/package.json` scripts updated to run migrations and seed before start.
- Security & performance middleware added (compression, rate limiting, Helmet, CORS, trust proxy, graceful shutdown).
- `/api/health` endpoint.
- `frontend/netlify.toml` with security headers and caching; `next.config.ts` tuned for production.
- Removed `@prisma/client` from frontend deps to reduce bundle size.
- Engine constraints added for Node 18+.
