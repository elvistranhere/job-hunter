# Setting Up Email Recipients for Daily Digest

This guide will help you configure the email addresses to receive the Job Hunter daily digest.

## Required Emails to Add

The following email addresses need to be added to receive the daily digest:
- khoinguyenmai17102005@gmail.com
- trunglamasia@gmail.com
- tridung.190705@gmail.com

## Step-by-Step Instructions

### 1. Add GitHub Secrets

You need to configure three secrets in your GitHub repository:

#### Navigate to Secrets Settings
1. Go to your repository on GitHub: https://github.com/elvistranhere/job-hunter
2. Click **Settings** (top menu)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret** for each secret below

#### Required Secrets

##### GMAIL_USER
- **Name**: `GMAIL_USER`
- **Value**: Your Gmail address (e.g., `your.email@gmail.com`)
- This is the Gmail account that will send the digest emails

##### GMAIL_APP_PASSWORD
- **Name**: `GMAIL_APP_PASSWORD`
- **Value**: Your Gmail App Password (NOT your regular password)
- **How to create an App Password**:
  1. Go to https://myaccount.google.com/apppasswords
  2. You may need to enable 2-Step Verification first
  3. Select "Mail" and "Other (Custom name)"
  4. Name it "Job Hunter"
  5. Copy the 16-character password

##### EMAIL_TO
- **Name**: `EMAIL_TO`
- **Value**: `khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com`
- **Important**: Use comma-separated format with NO spaces between emails
- This is the list of recipients who will receive the daily digest

### 2. Verify Configuration

After adding all three secrets:

1. Go to the **Actions** tab in your repository
2. Click on **Daily Job Scrape** workflow
3. Click **Run workflow** dropdown
4. Select options:
   - `Run full 3-city x 7-role search matrix`: Leave unchecked for quick test
   - `Minimum score threshold for email`: Set to `20` (default)
5. Click **Run workflow** button

### 3. Check Results

1. Wait 5-10 minutes for the workflow to complete
2. Check the workflow run status in the Actions tab
3. All three recipients should receive the email digest
4. Check the workflow logs to confirm email was sent successfully

## Troubleshooting

### Email Not Received
- Check spam/junk folders
- Verify the EMAIL_TO secret has no spaces after commas
- Check GitHub Actions logs for error messages

### Authentication Failed
- Ensure GMAIL_APP_PASSWORD is correct (16 characters, no spaces)
- Verify 2-Step Verification is enabled on Gmail account
- Try regenerating the App Password

### Workflow Failed
- Check the Actions tab for detailed error logs
- Ensure all three secrets are properly set
- Verify the Gmail account can send emails

## Testing Locally

To test the email configuration locally:

1. Create a `.env` file in the project root:
```bash
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
EMAIL_TO=khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com
```

2. Run the scraper and email digest:
```bash
uv run python scrape.py --hours 24 --results 20
uv run python email_digest.py --min-score 20
```

3. Check that all three recipients receive the email

## Notes

- The daily digest runs automatically at 9 PM UTC (approximately 7 AM Adelaide time)
- You can manually trigger the workflow anytime from the Actions tab
- The EMAIL_TO secret supports multiple recipients using comma-separated format
- Each recipient will receive the same email digest with all job listings
