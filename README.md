# Spendfolio

Private monthly expense tracker with income sources, customizable expenses, renewals, import preview, and authenticator 2FA.

## Stack

- Next.js (App Router)
- Prisma + Neon Postgres
- TOTP 2FA (authenticator app)

## Setup

1. Copy `.env.example` to `.env` and set:
   - `DATABASE_URL` — Neon Postgres connection string (`?sslmode=require`)
   - `AUTH_SECRET` — long random secret (16+ chars)
2. Install and migrate:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

3. (Optional) seed a demo user:

```bash
npm run db:seed
```

4. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account from `/login`, or sign in with the seed user if you ran the seed.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run db:deploy` — apply migrations
- `npm run db:seed` — seed demo data
