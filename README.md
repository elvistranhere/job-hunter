# Job Hunter AU

AI-powered job discovery for Australia. Scrapes 5 job boards, scores every listing by fit, and sends daily email digests.

## What It Does

1. **Scrapes** jobs from Indeed, Seek, LinkedIn, Prosple, and GradConnection
2. **Parses** your resume with AI (Gemini) to build a skill profile
3. **Scores** every job against your profile using a weighted algorithm
4. **Delivers** results via styled HTML email or web dashboard

Works in two modes:
- **CLI Mode** — Run locally, get a CSV + email digest
- **Web App Mode** — Upload resume, configure preferences, get daily emails

## Features

- 5 Australian job board scrapers (Indeed, Seek, LinkedIn, Prosple, GradConnection)
- AI resume parsing with structured skill extraction
- Configurable scoring with 8 weighted categories (skills, location, company tier, etc.)
- Interactive profile editor with weight sliders
- Styled HTML email digests with dark/light mode support
- Web dashboard for viewing past results
- Daily digest subscriptions via GitHub Actions
- Graduate/junior role targeting with senior-level penalties

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- npm
- PostgreSQL database (e.g., [Neon](https://neon.tech) free tier)
- [Gemini API key](https://aistudio.google.com) (for resume parsing)

### CLI Mode (Scrape + Email)

```bash
# Clone and install
git clone https://github.com/elvistran/job-hunter-au.git
cd job-hunter-au
uv sync

# Configure environment
cp .env.example .env
# Edit .env with your Gmail credentials (see Configuration below)

# Place your resume PDF in resumes/
cp ~/your-resume.pdf resumes/

# Run the scraper
uv run python scrape.py --hours 24 --no-senior

# Send email digest
uv run python email_digest.py --min-score 20

# Or preview without sending
uv run python email_digest.py --dry-run
```

### Web App Mode (Full Pipeline)

```bash
# Install web dependencies
cd web && npm install

# Configure environment
cp .env.example .env
# Edit with your DATABASE_URL, GEMINI_API_KEY, WORKER_URL

# Set up database
npx prisma db push && npx prisma generate

# Start the dev server
npm run dev  # → http://localhost:3000

# In another terminal, start the worker
cd .. && uv run uvicorn worker.main:app --reload --port 8000
```

Then visit the web app, upload your resume, and configure your scoring preferences.

## Architecture

```
web/              → Next.js 15 app (tRPC + Prisma + Tailwind)    → Vercel
worker/           → FastAPI Python worker (scrapers + scoring)    → Railway
scrape.py         → CLI scraping + scoring engine
scrapers_au.py    → 5 scrapers: Indeed, Seek, Prosple, GradConnection, LinkedIn
email_digest.py   → HTML email builder + Gmail SMTP
.github/workflows → GitHub Actions (daily digest, CI)
```

### Data Flow

```
Resume PDF → AI Parse → Skill Profile → Scrape 5 Boards → Score → Email/Dashboard
```

1. **Upload** — PDF resume parsed by Gemini into structured profile
2. **Profile** — Interactive editor for skill tiers and 8 weight sliders
3. **Scrape** — Worker hits 5 job boards across configurable cities and search terms
4. **Score** — Deterministic algorithm scores each job (skills, location, company, title, etc.)
5. **Deliver** — Styled HTML email digest or web dashboard

## Scoring System

Jobs are scored across 8 weighted categories. Each category has a 0x-2x multiplier that users can configure:

| Category | What it measures | Max points |
|----------|-----------------|------------|
| **Skills** | Match against your skill tiers (core/strong/peripheral) | Uncapped |
| **Company Tier** | Big Tech, notable AU companies, top tech | 12 |
| **Location** | City preference match, remote work | 15 |
| **Title Match** | Role title relevance (graduate, full-stack, etc.) | 18 |
| **Sponsorship** | Visa sponsorship signals | 12 |
| **Recency** | How recently the job was posted | 10 |
| **Culture** | Remote-first, equity, flexible hours | 15 |
| **Quality** | Salary transparency, detailed JD, benefits | 12 |

Negative penalties (bad titles, senior+ roles) are never weighted and always apply.

## Adding Your Resume

Place your PDF resume in the `resumes/` directory for CLI mode, or upload through the web interface. The AI parser extracts:

- Contact information
- Skills (categorized into core, strong, and peripheral tiers)
- Work experience
- Education
- Preferences (locations, role types)

See [`resumes/README.md`](resumes/README.md) for details.

## Configuration

### Root `.env` (CLI + Worker)

```bash
# Gmail SMTP for sending digests
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Comma-separated recipient list
EMAIL_TO=user1@example.com,user2@example.com

# Worker callback URL (web mode only)
CALLBACK_URL=https://your-app.vercel.app/api/callback
```

### `web/.env` (Web App)

```bash
# Neon Postgres connection string
DATABASE_URL="postgresql://..."

# Gemini API key for resume parsing
GEMINI_API_KEY="..."

# Worker URL (Railway or local)
WORKER_URL="https://your-worker.railway.app"
WORKER_SECRET="shared-secret"
```

## Deployment

### GitHub Actions (Daily Email Digest)

The included workflow can run daily scrapes on a schedule:

1. Fork this repo
2. Add GitHub Secrets: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_TO`
3. Enable the "Daily Job Scrape" workflow
4. Uncomment the cron schedule in `.github/workflows/daily-scrape.yml`

### Vercel (Web Frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from web/ directory
cd web && vercel
```

Set environment variables in the Vercel dashboard.

### Railway (Worker)

The worker includes a Dockerfile with Chromium and Xvfb for headless browser scraping (required by Seek).

```bash
# Deploy via Railway CLI or connect your GitHub repo
railway up
```

Set `CHROME_BINARY=/usr/bin/chromium` in Railway environment variables.

## Scrapers

| Scraper | Method | Notes |
|---------|--------|-------|
| **Indeed** | [JobSpy](https://github.com/Bunsly/JobSpy) library | Searches per city + term |
| **Seek** | [nodriver](https://github.com/nicegui-tw/nodriver) (undetected Chrome) | Requires display (Xvfb on Linux) |
| **LinkedIn** | HTTP requests | Rate limited (max 3 workers, retries on 429) |
| **Prosple** | GraphQL API | National results, searches per term only |
| **GradConnection** | HTTP scraping | Simple User-Agent header |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, how to add new scrapers, and PR guidelines.

## License

[MIT](LICENSE)
