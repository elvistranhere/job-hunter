# Job Hunter AU

A job-hunting app with two supported modes on one unified automation path:

1. **CLI mode**: edit `profile.json`, run scraper locally or via GitHub Actions
2. **Web mode**: use the web app for resume parsing + subscriptions, then GitHub Actions triggers web cron

`profile.json` is deterministic after resume parsing/customization, so daily scraping does not need extra AI calls.

## Quick Start (CLI)

1. Fork + clone this repo
2. Create your profile and edit it with your skills/preferences:

```bash
cp profile.example.json profile.json
```

3. Install dependencies:

```bash
uv sync
```

4. Run a focused scrape:

```bash
uv run python scrape.py --profile profile.json --hours 24
```

5. Send digest email:

```bash
uv run python email_digest.py
```

## Daily Automation (GitHub Actions)

1. Fork the repo
2. Add your `profile.json` to your fork (private fork recommended). Because `profile.json` is gitignored, use:

```bash
git add -f profile.json
```

3. Add repository secrets:
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `EMAIL_TO`

4. Enable Actions and uncomment the cron line in `.github/workflows/daily-jobs.yml`
5. Done: the unified workflow runs daily and sends emails

## Web App (Full Experience)

1. Deploy `web/` (Vercel) + Postgres (Neon)
2. Upload PDF resume in the web app, let AI parse to profile JSON
3. Customize scoring and subscribe for daily digests (7/14/30 days)
4. GitHub Actions runs daily and calls the web cron API for web subscriptions

For web mode in Actions, add these secrets:
- `APP_URL`
- `CRON_SECRET`

Then run `Daily Jobs` manually with `mode=web`.

## Unified Architecture

```text
Web App (Vercel)                    GitHub Actions (User's Fork)
┌───────────────────┐               ┌──────────────────────────┐
│ Upload resume     │               │ daily-jobs.yml           │
│ AI parses → JSON  │               │                          │
│ Customize scoring │               │ Mode: cli                │
│ Select days (7/14/30)            │   1. Read profile.json   │
│ → First email sent │              │   2. Run scrape.py       │
│   immediately     │               │   3. Score & email       │
│                   │               │                          │
│ Export profile.json│──(commit)──→ │ Mode: web                │
│                   │               │   1. Call /api/cron/...  │
└───────────────────┘               └──────────────────────────┘
```

## Environment Variables

Root `.env` (CLI email):
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `EMAIL_TO`

`web/.env`:
- `DATABASE_URL`
- `GEMINI_API_KEY`
- `CRON_SECRET`
- Optional legacy worker vars (commented in example)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
