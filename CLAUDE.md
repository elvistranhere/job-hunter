# Job Hunter - AI Job Scraper for Australia

Scrapes 5 job boards across Adelaide/Sydney/Melbourne, parses your LaTeX resume to score jobs by fit.

## Slash Command

```
/find-jobs                          # Full run: 3 cities x 6 role searches, scored by resume
/find-jobs --hours 24               # Last 24 hours only
/find-jobs --big-tech               # Only big tech / notable AU companies
/find-jobs --location Sydney        # Single city
/find-jobs --search "DevOps"        # Custom search term
/find-jobs --top 50                 # Show more results
```

## How It Works

1. **Parses** your LaTeX resume (`resumes/*.tex`) → extracts skills, job titles, tech keywords
2. **Scrapes** LinkedIn, Indeed, Glassdoor, Google Jobs, ZipRecruiter
3. **Searches** 6 roles x 3 cities = 18 searches (Adelaide → Sydney → Melbourne)
4. **Scores** every job: company tier + location priority + title match + skill overlap
5. **Ranks** and saves to `jobs/` as CSV + Excel

## Scoring

| Factor | Points |
|--------|--------|
| Big Tech company (Google, Meta, Atlassian...) | +30 |
| AU Notable company (Canva, Seek, REA Group...) | +25 |
| Top Tech company (Anthropic, Vercel, Figma...) | +20 |
| Adelaide location | +15 |
| Sydney location | +12 |
| Melbourne location | +10 |
| Remote | +5 |
| Full Stack title | +15 |
| Frontend title | +12 |
| Software Engineer title | +10 |
| Each resume skill match | +3 (cap 30) |
| Each keyword match | +2 (cap 20) |

## Direct Python

```bash
uv run python scrape.py
uv run python scrape.py --big-tech --hours 24
uv run python scrape.py --location Adelaide --search "React Developer"
```

## Email Digest Setup

The project includes automated daily email digests via GitHub Actions. To configure email recipients:

1. See **[SETUP_EMAILS.md](./SETUP_EMAILS.md)** for complete setup instructions
2. Set GitHub secrets: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_TO`
3. `EMAIL_TO` supports multiple comma-separated recipients

**Current recipients**:
- khoinguyenmai17102005@gmail.com
- trunglamasia@gmail.com
- tridung.190705@gmail.com
