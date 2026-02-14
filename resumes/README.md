# Resumes

Place your resume PDF here for reference. The web app and CLI use `profile.json` (not raw resume files) for job matching.

## How It Works

1. Upload your PDF via the web app (`npm run dev` in `web/`)
2. AI parses your skills, titles, and experience
3. You customize and export `profile.json`
4. The scraper uses `profile.json` for scoring

## Privacy

Resume files are gitignored and will never be committed to the repository.
