# Job Hunter AU — Web App

Next.js 15 frontend for Job Hunter AU. Built with the T3 stack (tRPC + Prisma + Tailwind).

See the [root README](../README.md) for full project documentation.

## Quick Start

```bash
npm install
cp .env.example .env  # Fill in DATABASE_URL, GEMINI_API_KEY, etc.
npx prisma db push && npx prisma generate
npm run dev
```

## Tech Stack

- **Next.js 15** with App Router
- **tRPC** for type-safe API routes
- **Prisma** with Neon Postgres
- **Tailwind CSS v4**
- **Gemini 2.5 Flash Lite** for resume parsing
