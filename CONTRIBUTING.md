# Contributing to Job Hunter AU

Thanks for your interest in contributing! This guide covers development setup, project structure, and how to add new features.

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- npm
- PostgreSQL database ([Neon](https://neon.tech) free tier works great)
- [Gemini API key](https://aistudio.google.com) (for resume parsing)

### Clone and Install

```bash
git clone https://github.com/elvistran/job-hunter-au.git
cd job-hunter-au

# Python dependencies
uv sync

# Web dependencies
cd web && npm install
```

### Environment Variables

```bash
# Root .env (CLI + worker)
cp .env.example .env

# Web .env
cp web/.env.example web/.env
```

Fill in your credentials — see [README.md](README.md#configuration) for details.

### Run Locally

```bash
# Web app (terminal 1)
cd web && npm run dev

# Worker (terminal 2)
uv run uvicorn worker.main:app --reload --port 8000
```

### Database Setup

```bash
cd web
npx prisma db push    # Create/update tables
npx prisma generate   # Generate client
```

## Project Structure

```
scrape.py           — CLI entry point: resume parsing, orchestration, scoring, CSV output
scrapers_au.py      — 5 scrapers (Indeed, Seek, Prosple, GradConnection, LinkedIn)
email_digest.py     — HTML email builder + SMTP sender
worker/main.py      — FastAPI wrapper for web pipeline
worker/Dockerfile   — Production image (Python 3.12 + Chromium + Xvfb)
web/                — Next.js 15 T3 app (tRPC + Prisma + Tailwind)
  prisma/schema.prisma  — Database schema
  src/server/api/       — tRPC routers
  src/app/              — Next.js pages
```

## How to Add a New Scraper

1. Add your scraper function to `scrapers_au.py`:

```python
def scrape_yoursite(search_term: str, location: str, max_results: int = 50) -> list[dict]:
    """Scrape YourSite for job listings."""
    jobs = []
    # Your scraping logic here
    # Each job dict should have these fields:
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

2. Add your scraper to the orchestration in `scrape.py` (in the `scrape_all()` function)

3. Test it:
```bash
uv run python -c "from scrapers_au import scrape_yoursite; print(scrape_yoursite('software engineer', 'Sydney'))"
```

### Scraper Guidelines

- Return a list of dicts with the standard fields above
- Handle rate limiting gracefully (retries with backoff)
- Use descriptive `source` field names
- Log progress with `print()` for CLI visibility
- Handle errors per-listing (don't let one bad listing crash the whole scraper)

## How to Modify Scoring

The scoring algorithm lives in `scrape.py` in the `score_job()` function. It uses 8 weighted categories:

- Each category produces a raw score
- Users configure multipliers (0x-2x) for each category
- Negative penalties (bad titles, senior roles) are never weighted

To add a new scoring signal:
1. Add the scoring logic in `score_job()`
2. Add a weight key if it should be user-configurable
3. Update the web profile editor if adding a new weight slider

## Code Style

- **Python**: Format with `ruff format`, lint with `ruff check`
- **TypeScript**: ESLint + Prettier (configured in web/)

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
3. Make your changes
4. Run linting and type checks
5. Submit a PR with a clear description of what and why

### Commit Messages

Use conventional commit style:
- `feat: add Glassdoor scraper`
- `fix: handle LinkedIn 429 rate limit`
- `docs: update deployment guide`
- `refactor: extract scoring into separate module`

## Questions?

Open an issue or start a discussion on GitHub.
