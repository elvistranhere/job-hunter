# Job Hunter — AI-Powered Job Search Platform (Australia)

## Vision
Automated job discovery + scoring platform: scrapes 5 AU job boards, AI-parses any resume, scores every job by fit, delivers daily email digests. Future: auto-apply pipeline.

## Quick Start

```bash
# Web app (Next.js)
cd web && npm run dev              # → http://localhost:3006

# Worker (FastAPI)
uv run uvicorn worker.main:app --reload --port 8000

# CLI scrape + email
uv run python scrape.py            # Full 3-city × 7-role matrix
uv run python scrape.py --hours 24 --no-senior
uv run python email_digest.py --dry-run   # Preview without sending

# Database
cd web && npx prisma db push && npx prisma generate
```

## Architecture

```
web/              → Next.js 15 T3 app (tRPC + Prisma + Tailwind) — Vercel
worker/           → FastAPI Python worker (scrapers + scoring) — Railway
scrape.py         → Core scraping + scoring engine (CLI entry point)
scrapers_au.py    → 5 scrapers: Indeed, Seek, Prosple, GradConnection, LinkedIn
email_digest.py   → HTML email rendering + Gmail SMTP (dark/light mode)
resumes/          → LaTeX resume source files (CLI mode)
.github/workflows → Daily digest cron (daily-scrape.yml) + web subscriptions (daily-digest.yml)
```

### Data Flow
1. **Upload**: PDF resume + email → Gemini 2.5-flash-lite parses → structured profile
2. **Profile**: Interactive editor — skill tiers, 8 weight sliders, AI-suggested preferences
3. **Scrape**: Worker hits 5 job boards (orchestrated: Seek/LinkedIn/Indeed per city×term, GradConnection per city, Prosple per term)
4. **Score**: Deterministic algorithm — skills, company tier, location, title, sponsorship, recency, culture, quality
5. **Deliver**: Styled HTML email digest (system dark/light mode) or web dashboard

### Key Integrations
- **Neon Postgres** — Prisma ORM, cuid IDs
- **Gemini 2.5-flash-lite** — Resume parsing (best accuracy/speed/cost ratio)
- **Railway** — Worker deployment (Docker + Xvfb + Chromium for Seek)
- **Vercel** — Frontend deployment
- **GitHub Actions** — Daily cron trigger
- **Gmail SMTP** — Email delivery (App Password auth)

## Web Routes

| Route | Purpose |
|-------|---------|
| `/` | Upload PDF + email |
| `/profile/[id]` | Interactive scoring editor |
| `/confirmation/[id]` | "We're on it" holding page |
| `/status/[id]` | Progress stepper (polls 2s) |
| `/dashboard` | Email lookup → past submissions |
| `/dashboard/[id]` | Job results table + analytics |
| `/subscription/[id]` | Manage daily digest subscription |

## Key Files

### Web (TypeScript/Next.js)
- `web/prisma/schema.prisma` — Submission, ResumeProfile, JobResult, Subscription, SubscriptionRun
- `web/src/server/api/routers/submission.ts` — Main tRPC router (parseResume, getProfile, startScraping, etc.)
- `web/src/server/api/routers/subscription.ts` — Subscription CRUD
- `web/src/server/lib/resume-parser.ts` — unpdf + Gemini PDF parsing
- `web/src/server/lib/worker-client.ts` — HTTP client → Railway worker
- `web/src/app/api/callback/route.ts` — Worker callback (stores JobResult records)
- `web/src/app/api/cron/daily-digest/route.ts` — Cron endpoint for web subscriptions

### Python (Scrapers/Scoring)
- `scrape.py` — CLI entry: resume parsing, scraper orchestration, scoring, CSV output
- `scrapers_au.py` — 5 scrapers (Indeed via JobSpy, Seek via nodriver, Prosple GraphQL, GradConnection, LinkedIn)
- `email_digest.py` — HTML email builder + SMTP sender
- `worker/main.py` — FastAPI wrapper for web pipeline
- `worker/Dockerfile` — Production image (Python 3.12 + Chromium + Xvfb)
- `worker/start.sh` — Xvfb init + uvicorn startup

## Scoring System

8 weighted categories (0x–2x multiplier each):
- **companyTier**: Big Tech +12, AU Notable +10, Top Tech +8
- **location**: Adelaide +15, Sydney/Melbourne +12, Remote +5
- **titleMatch**: Graduate/Full Stack +18, Frontend +15, SWE +14
- **skills**: Core +5, Strong +3, Peripheral +1 (+ adjacency +2 each, cap 10)
- **sponsorship**: Visa signals +4 each (cap 12)
- **recency**: Today +10, this week +6, this month +3
- **culture**: Remote-first, equity, flexible hours (bonus only, cap 15)
- **quality**: Salary transparency +5, long JD +3, benefits +4 (cap 12)

Negative penalties (bad titles -20, senior+ -5) are NEVER weighted.

## Environment Variables

### Root `.env` (CLI + worker reads this)
```
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
EMAIL_TO=user1@gmail.com,user2@gmail.com
CALLBACK_URL=https://your-app.vercel.app/api/callback
```

### `web/.env`
```
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."
WORKER_URL="https://your-worker.railway.app"
WORKER_SECRET="shared-secret"
```

### GitHub Secrets (for Actions)
`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_TO`, `CRON_SECRET`, `APP_URL`

## Critical Gotchas

### Database
- Prisma JSON fields: wrap with `JSON.parse(JSON.stringify(data))`
- Prisma client output: `../generated/prisma` (custom path)
- After `prisma db push`, MUST run `prisma generate` and restart dev
- Query DB: use `node -e` with PrismaClient (not `prisma db execute`)

### Scrapers
- **Seek**: Only works via `nodriver` (undetected Chrome, headless=False). Needs display (macOS native, Linux needs Xvfb). Browser reused via `_seek_browser` global with thread-local event loop.
- **GitHub Actions**: Set `CHROME_BINARY=/usr/bin/google-chrome-stable` + `xvfb-run` wrapper
- **Docker/Railway**: Set `CHROME_BINARY=/usr/bin/chromium` + `--no-sandbox` + Xvfb via start.sh
- **LinkedIn**: max_workers=3, retry on 429
- **GradConnection**: Simple User-Agent only (no sec-fetch-* headers)
- **Prosple**: National results — call once per search term, not per city

### Worker
- Imports root scripts via `sys.path.insert(0, parent_dir)`
- `convert_profile()` returns local dict — NEVER mutate global SKILL_TIERS
- CALLBACK_URL must be in root `.env` — worker reads from env, not request payload
- Pandas NaN/NaT break JSON — use `_safe_str()` / `_safe_float()` sanitizers

### Build/Deploy
- `SKIP_ENV_VALIDATION=1` needed for builds without env vars
- ANTHROPIC_API_KEY is optional in env.js (GEMINI_API_KEY is primary)
- unpdf replaces pdf-parse (serverless compatible)

## Design System
- **Fonts**: Instrument Serif (headings) + DM Sans (body)
- **Palette**: Deep navy (#060a14 → #e8ecf2), amber accents (#f59e0b)
- **Components**: Grain overlay, animated dropzone, score/tier badges
- **Email**: System dark/light mode via `@media (prefers-color-scheme: dark)`, light mode inline default

## CLI Shortcuts (Claude Code)

```
/find-jobs                    # Full scrape + results analysis
/find-jobs --hours 24         # Last 24h only
/find-jobs --big-tech         # Notable companies only
/find-jobs --location Sydney  # Single city
```
