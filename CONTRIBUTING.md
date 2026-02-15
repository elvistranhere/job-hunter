# Contributing to Job Hunter AU

Thanks for contributing. This guide covers local setup, project structure, and scraper extension.

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/)
- npm
- Gemini API key (for web resume parsing)

### Clone and Install

```bash
git clone https://github.com/elvistranhere/job-hunter.git
cd job-hunter

# Python dependencies
uv sync

# Web dependencies
cd web && npm install
```

### Environment Variables

```bash
# Root .env (CLI email — optional for local dev)
cp .env.example .env

# Web .env
cp web/.env.example web/.env
# Add your GEMINI_API_KEY
```

### Run Locally

```bash
# Terminal 1: web app (localhost:3006)
cd web && npm run dev

# Terminal 2: run CLI scrape when needed
uv run python scrape.py --profile profile.json
uv run python email_digest.py --profile profile.json
```

No database setup required — the web app runs entirely locally.

## Project Structure

```text
profile.example.json  — Starter profile template
scrape.py             — Orchestration + scoring engine
scrapers_au.py        — Job board scrapers (5 sources)
email_digest.py       — HTML email rendering + SMTP sender
web/                  — Next.js app (local profile builder)
  src/app/page.tsx    — Single-page wizard UI
  src/app/api/        — Resume parsing + GitHub setup APIs
  src/server/lib/     — Resume parser (Gemini AI)
.github/workflows/    — CI + daily jobs automation
```

## How to Add a New Scraper

1. Add a scraper function in `scrapers_au.py`:

```python
def scrape_yoursite(search_term: str, location: str, max_results: int = 50) -> list[dict]:
    """Scrape YourSite for job listings."""
    jobs = []
    job = {
        "title": "Software Engineer",
        "company": "Acme Corp",
        "location": "Sydney, NSW",
        "url": "https://yoursite.com/job/123",
        "description": "Full job description text...",
        "date_posted": "2026-01-15",
        "source": "YourSite",
    }
    jobs.append(job)
    return jobs
```

2. Register it in `scrape.py` orchestration (`scrape_all()`)
3. Test directly:

```bash
uv run python -c "from scrapers_au import scrape_yoursite; print(scrape_yoursite('software engineer', 'Sydney'))"
```

### Scraper Guidelines

- Return a list of dicts with standard fields
- Handle rate limits and retries safely
- Set a clear `source` value
- Log useful progress for CLI visibility
- Handle per-listing failures so one bad record does not crash the run

## How to Modify Scoring

Scoring is in `scrape.py` (`score_job()`) using weighted categories.

To add a new scoring signal:
1. Add logic in `score_job()`
2. Add a weight key if user-configurable
3. Update the web profile editor if adding a new weight control

## Code Style

- Python: `ruff format` and `ruff check`
- TypeScript: `tsc --noEmit` in `web/`

```bash
# Python
uv run ruff format .
uv run ruff check . --fix

# TypeScript
cd web && npm run typecheck
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make changes
4. Run linting and type checks
5. Open a PR with clear context

### Commit Message Examples

- `feat: add Glassdoor scraper`
- `fix: handle LinkedIn 429 rate limit`
- `docs: update actions setup guide`
- `refactor: extract scoring helpers`

## Questions

Open an issue or discussion on GitHub.
