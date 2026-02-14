# Job Hunter AU

Automated job discovery for Australia. Upload your resume, AI parses your skills, then GitHub Actions scrapes 5 job boards daily and emails you ranked results.

**Zero hosting required** — just a profile file and a GitHub Actions cron job.

## Demo

<video src="https://raw.githubusercontent.com/elvistranhere/job-hunter-assets/main/demo.mp4" width="100%" autoplay loop muted playsinline></video>

## Screenshots

| Upload & Parse | Profile Editor |
|:-:|:-:|
| ![Homepage](https://raw.githubusercontent.com/elvistranhere/job-hunter-assets/main/01-homepage.png) | ![Profile Editor](https://raw.githubusercontent.com/elvistranhere/job-hunter-assets/main/02-profile-editor.png) |

| Scoring Weights | Export JSON |
|:-:|:-:|
| ![Scoring Weights](https://raw.githubusercontent.com/elvistranhere/job-hunter-assets/main/03-scoring-weights.png) | ![Export JSON](https://raw.githubusercontent.com/elvistranhere/job-hunter-assets/main/04-export-json.png) |

| GitHub Automation |
|:-:|
| ![GitHub Automation](https://raw.githubusercontent.com/elvistranhere/job-hunter-assets/main/05-github-automation.png) |

## How It Works

```text
Resume PDF                     GitHub Actions (your fork)
    |                          +--------------------------+
    v                          |  daily-jobs.yml (cron)   |
 Web App (local)               |                          |
 npm run dev                   |  1. Read profile.json    |
    |                          |  2. Scrape 5 job boards  |
    +--> profile.json --+--->  |  3. Score & rank jobs    |
                        |      |  4. Email digest          |
                        |      +--------------------------+
                        |
                        +---> Or run locally:
                              uv run python scrape.py
```

## Quick Start

### Option A: Web App (recommended)

The web app parses your resume with AI and lets you customize scoring — then sets up GitHub Actions automatically.

```bash
cd web
cp .env.example .env        # Add your GEMINI_API_KEY
npm install
npm run dev                  # Opens on localhost:3006
```

1. Upload your resume PDF
2. Review and customize skill tiers, scoring weights, locations, and roles
3. Download `profile.json`
4. Click "Set Up Automation" to fork, configure secrets, and enable daily cron — all from the browser

### Option B: CLI Only

```bash
# 1. Create your profile
cp profile.example.json profile.json
# Edit profile.json with your skills, locations, roles, and weights

# 2. Install Python dependencies
uv sync

# 3. Run a scrape
uv run python scrape.py --profile profile.json --hours 24

# 4. Send email digest
GMAIL_USER=you@gmail.com GMAIL_APP_PASSWORD=xxxx EMAIL_TO=you@gmail.com \
  uv run python email_digest.py
```

## Daily Automation (GitHub Actions)

1. **Fork this repo** — click [Fork](https://github.com/elvistranhere/job-hunter/fork) on GitHub
2. **Add your `profile.json`** (generated from the web app or copied from `profile.example.json`):
   ```bash
   git add -f profile.json && git commit -m "Add my profile" && git push
   ```
3. **Set repository secrets** — go to your fork's **Settings > Secrets and variables > Actions** and add:
   | Secret | Value |
   |--------|-------|
   | `GMAIL_USER` | Your Gmail address |
   | `GMAIL_APP_PASSWORD` | [Gmail App Password](https://myaccount.google.com/apppasswords) (16-character) |
   | `EMAIL_TO` | Comma-separated recipient emails |
4. **Enable Actions** — go to your fork's **Actions** tab, click "I understand my workflows, go ahead and enable them"
5. **Uncomment the cron schedule** — edit `.github/workflows/daily-jobs.yml` and change:
   ```yaml
   # schedule:
   #   - cron: '0 21 * * *'
   ```
   to:
   ```yaml
   schedule:
     - cron: '0 21 * * *'   # 9pm UTC = 7am AEST
   ```
6. **Trigger the first run** — go to **Actions > Daily Jobs > Run workflow**

You'll receive an email with ranked job results within ~15 minutes. After that, the cron runs daily.

### Gmail App Password

Go to [Google Account > App Passwords](https://myaccount.google.com/apppasswords), generate one for "Mail", and use it as `GMAIL_APP_PASSWORD`. You need 2-Step Verification enabled on your Google account first.

## Job Boards

| Board | Method |
|-------|--------|
| Indeed | HTTP scraping |
| Seek | Browser automation (nodriver) |
| Prosple | GraphQL API |
| GradConnection | HTTP scraping |
| LinkedIn | HTTP scraping |

## Scoring

Jobs are scored on 8 weighted dimensions:

| Category | Base Points | What It Measures |
|----------|------------|-----------------|
| Skills Match | 55 | Core/strong/peripheral skill matches + adjacency |
| Location | 20 | Preferred cities + remote bonus |
| Title Match | 18 | Job title vs. your professional identity |
| Culture | 15 | Remote-first, equity, flex hours, learning budget |
| Company Tier | 12 | Big Tech, AU Notable, Top Tech companies |
| Sponsorship | 12 | Visa sponsorship signals |
| Job Quality | 12 | Salary transparency, detailed descriptions |
| Recency | 10 | Newer postings score higher |

All weights are configurable in `profile.json` (0x = off, 1x = default, 2x = double).

## Project Structure

```text
profile.example.json        Starter profile template
scrape.py                   Orchestration + scoring engine
scrapers_au.py              Job board scrapers (5 sources)
email_digest.py             HTML email rendering + SMTP
web/                        Next.js app (local profile builder)
  src/app/                  Single-page wizard UI
  src/app/api/              Resume parsing + GitHub setup APIs
  src/server/lib/           Resume parser (Gemini AI)
.github/workflows/          CI + daily jobs automation
```

## Environment Variables

**Web app** (`web/.env`):
- `GEMINI_API_KEY` — Google AI API key for resume parsing
- `NEXT_PUBLIC_GITHUB_CLIENT_ID` — OAuth app client ID (optional, for automated setup)

**GitHub Actions secrets** (or CLI `.env`):
- `GMAIL_USER` — Gmail address
- `GMAIL_APP_PASSWORD` — Gmail app password
- `EMAIL_TO` — Comma-separated recipient emails

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
