# 📧 INSTRUCTIONS: Add Email Recipients to Daily Digest

## What This Does

These instructions will help you add three email addresses to receive daily job digest emails:
- khoinguyenmai17102005@gmail.com
- trunglamasia@gmail.com
- tridung.190705@gmail.com

## ⚠️ Important: You Need Repository Admin Access

Only repository owners/admins can update GitHub secrets. Make sure you're logged into GitHub as the repository owner.

---

## Step-by-Step Instructions

### Step 1: Navigate to Repository Secrets

1. Open your web browser
2. Go to: https://github.com/elvistranhere/job-hunter/settings/secrets/actions
3. You should see a page titled "Actions secrets and variables"

**Note**: If you get a 404 error, you don't have admin access. Ask the repository owner to follow these steps.

---

### Step 2: Find or Create EMAIL_TO Secret

Look for a secret named `EMAIL_TO` in the list.

#### Option A: If EMAIL_TO exists
1. Click the **Edit** button (pencil icon) next to `EMAIL_TO`
2. In the "Value" field, replace the existing value with:
   ```
   khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com
   ```
3. Click **Update secret** (green button)

#### Option B: If EMAIL_TO doesn't exist
1. Click **New repository secret** (green button)
2. In the "Name" field, type: `EMAIL_TO`
3. In the "Value" field, paste:
   ```
   khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com
   ```
4. Click **Add secret** (green button)

---

### Step 3: Verify Other Required Secrets

Make sure these secrets also exist (don't edit them unless you need to):

- ✅ **GMAIL_USER** - Should contain the Gmail address that sends emails
- ✅ **GMAIL_APP_PASSWORD** - Should contain a Gmail App Password

If these are missing, see [SETUP_EMAIL_RECIPIENTS.md](./SETUP_EMAIL_RECIPIENTS.md) for setup instructions.

---

### Step 4: Trigger a Test Run

Now let's test that the email recipients work:

1. Go to: https://github.com/elvistranhere/job-hunter/actions/workflows/daily-scrape.yml
2. You should see "Daily Job Scrape" workflow page
3. Click the **Run workflow** dropdown (on the right side)
4. You'll see options:
   - **Branch**: Leave as `main` (or current branch)
   - **Run full 3-city x 7-role search matrix**: Leave as `false` (faster test)
   - **Minimum score threshold for email**: Leave as `20` (reasonable default)
5. Click the green **Run workflow** button
6. Wait 30 seconds, then refresh the page
7. You should see a new workflow run starting (yellow dot → green check)

---

### Step 5: Check Workflow Status

1. Click on the workflow run you just started
2. Watch the progress - it should take 5-10 minutes
3. Look for these steps:
   - ✅ Run scraper (focused daily)
   - ✅ Send email digest
   - ✅ Upload results

If "Send email digest" shows a green checkmark, the emails were sent successfully!

---

### Step 6: Verify Email Receipt

All three recipients should receive an email within 5-10 minutes:

**Subject**: `Job Hunter: X relevant jobs (DD MMM YYYY)`

**From**: Your configured GMAIL_USER address

**Contents**: HTML email with:
- Top jobs section
- Notable companies
- Remote jobs
- Seniority breakdown
- Statistics

**Check**:
- ✅ khoinguyenmai17102005@gmail.com
- ✅ trunglamasia@gmail.com  
- ✅ tridung.190705@gmail.com

If emails don't arrive, check spam/junk folders first.

---

## ✅ Done!

The three email addresses are now configured to receive daily job digests automatically at:
- **Time**: 9pm UTC
- **Local**: ~7am ACST (Adelaide) / ~7:30am ACST
- **Frequency**: Daily
- **Content**: Top 20+ jobs from last 24 hours

---

## Troubleshooting

### "404 Not Found" when accessing settings
- You need admin/owner access to the repository
- Ask the repository owner to add the emails

### Email not received after test run?
1. Check spam/junk folders
2. Check workflow logs:
   - Go to Actions → Click the workflow run → Click "Send email digest"
   - Look for errors in the logs
3. Verify secrets are correct:
   - GMAIL_USER should be a valid Gmail address
   - GMAIL_APP_PASSWORD should be a 16-character app password
   - EMAIL_TO should have all three emails

### Want to add more recipients later?
1. Go back to Step 2
2. Edit EMAIL_TO secret
3. Add new emails separated by commas:
   ```
   email1@gmail.com,email2@gmail.com,email3@gmail.com,newemail@gmail.com
   ```

### Want to stop emails for someone?
1. Go back to Step 2
2. Edit EMAIL_TO secret
3. Remove their email from the comma-separated list

---

## Alternative: Using GitHub CLI

If you have GitHub CLI (`gh`) installed and authenticated:

```bash
# Update EMAIL_TO secret
gh secret set EMAIL_TO -b "khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com"

# Trigger workflow
gh workflow run daily-scrape.yml

# Or use the provided script
./trigger_job_scrape.sh
```

---

## Need Help?

See detailed documentation:
- **Quick Start**: [QUICKSTART_EMAIL.md](./QUICKSTART_EMAIL.md)
- **Full Setup Guide**: [SETUP_EMAIL_RECIPIENTS.md](./SETUP_EMAIL_RECIPIENTS.md)
- **Project Overview**: [CLAUDE.md](./CLAUDE.md)
