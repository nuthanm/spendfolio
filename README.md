# Spendfolio

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/nuthanm/spendfolio?include_prereleases&sort=semver)](https://github.com/nuthanm/spendfolio/releases)
[![GitHub stars](https://img.shields.io/github/stars/nuthanm/spendfolio?style=social)](https://github.com/nuthanm/spendfolio/stargazers)

Private monthly expense tracker with income sources, customizable expenses, renewals, import preview, and authenticator 2FA.

## Stack

- Next.js (App Router)
- Prisma + Neon Postgres
- TOTP 2FA (authenticator app)

## Setup

1. Copy the sample env file and fill values:

```bash
cp .env.sample .env
```

2. Set `DATABASE_URL` to your Neon Postgres connection string (`?sslmode=require`).

3. Generate `AUTH_SECRET` (pick one), then paste it into `.env`:

```bash
# Node (cross-platform)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# OpenSSL
openssl rand -base64 32

# PowerShell (Windows)
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

4. Install and migrate:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

5. (Optional) seed a demo user:

```bash
npm run db:seed
```

6. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account from `/login`, or sign in with the seed user if you ran the seed.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run db:deploy` — apply migrations
- `npm run db:seed` — seed demo data
