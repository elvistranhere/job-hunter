# Email Recipients Setup Guide

This guide explains how to configure multiple email recipients for the Job Hunter daily digest.

## Overview

The Job Hunter sends daily email digests of job postings to configured recipients. The system already supports multiple email addresses through GitHub Secrets.

## Current Configuration

The daily digest workflow uses three GitHub secrets:
- `GMAIL_USER` - The Gmail account used to send emails
- `GMAIL_APP_PASSWORD` - The Gmail App Password (not regular password)
- `EMAIL_TO` - Comma-separated list of recipient email addresses

## Adding New Email Recipients

### Step 1: Update the EMAIL_TO Secret

1. Go to your GitHub repository: https://github.com/elvistranhere/job-hunter
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Find the `EMAIL_TO` secret and click **Edit** (or create it if it doesn't exist)
4. Update the value to include all recipients as a comma-separated list:

```
khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com
```

**Important**: 
- Separate email addresses with commas (,)
- No spaces between emails (or use comma-space consistently)
- All recipients will receive the same digest email

### Step 2: Verify Other Secrets

Make sure these secrets are also configured:

- **GMAIL_USER**: The Gmail address that will send the emails
- **GMAIL_APP_PASSWORD**: A Gmail App Password (see instructions below)

### Step 3: Trigger a Test Run

After updating the secrets:

1. Go to **Actions** → **Daily Job Scrape** workflow
2. Click **Run workflow**
3. Optionally adjust parameters:
   - `full_run`: Set to `true` for a comprehensive search
   - `min_score`: Set to `20` for reasonable filtering
4. Click the green **Run workflow** button

The workflow will:
- Scrape job listings
- Score them based on your resume
- Send an email digest to all configured recipients

## Gmail App Password Setup

If you haven't set up a Gmail App Password:

1. Go to your Google Account: https://myaccount.google.com/
2. Select **Security** → **2-Step Verification** (enable if not already)
3. Scroll down to **App passwords**
4. Click **Generate** and select **Mail** → **Other** (name it "Job Hunter")
5. Copy the 16-character password and add it as `GMAIL_APP_PASSWORD` secret

See: https://support.google.com/accounts/answer/185833

## Testing Locally

To test email sending locally without GitHub Actions:

1. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

2. Edit `.env` with your credentials:
```
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
EMAIL_TO=khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com
```

3. Run the scraper and email digest:
```bash
# Run scraper (generates jobs/ranked-jobs_*.csv)
uv run python scrape.py --hours 24 --results 20

# Send email digest
uv run python email_digest.py --min-score 20
```

4. Or preview the email without sending:
```bash
uv run python email_digest.py --dry-run
# Opens jobs/email_preview.html
```

## Email Format

The email digest includes:
- **Top Jobs**: Jobs scoring above the minimum threshold
- **Notable Companies**: Jobs from Big Tech, Top Tech, or AU Notable companies
- **Remote Jobs**: Remote work opportunities
- **Seniority Breakdown**: Distribution of jobs by seniority level
- **Statistics**: Total jobs, top score, notable companies count

## Workflow Schedule

The daily scrape runs automatically:
- **Time**: 9pm UTC (approximately 7am Adelaide/Sydney time)
- **Frequency**: Daily
- **Searches**: 3 cities (Adelaide, Sydney, Melbourne) × 6 role types
- **Time Range**: Last 24 hours
- **Top Results**: 20 best matching jobs

## Troubleshooting

### Email not received?

1. Check spam/junk folders
2. Verify the EMAIL_TO secret is correct
3. Check workflow logs in GitHub Actions
4. Ensure GMAIL_APP_PASSWORD is valid (not expired)

### Wrong jobs in digest?

1. Update your resume in `resumes/` directory
2. Adjust `--min-score` parameter (default: 20)
3. Check scoring logic in `scrape.py`

### Want more jobs?

Trigger workflow manually with:
- `full_run: true` - Searches more roles and cities
- `min_score: 10` - Lower threshold for more results

## Current Recipients

After following Step 1 above, the daily digest will be sent to:
- khoinguyenmai17102005@gmail.com
- trunglamasia@gmail.com  
- tridung.190705@gmail.com

## Support

For issues or questions:
1. Check workflow run logs in GitHub Actions
2. Review `email_digest.py` for email sending logic
3. Verify secrets are configured correctly in repository settings
