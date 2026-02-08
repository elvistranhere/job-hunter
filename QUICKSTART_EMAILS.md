# Quick Start: Adding Email Recipients

## What You Need to Do

I've prepared the documentation, but **GitHub secrets cannot be modified through code**. You need to add them manually through GitHub's web interface.

## The 3 Email Addresses to Add
- khoinguyenmai17102005@gmail.com
- trunglamasia@gmail.com
- tridung.190705@gmail.com

## Quick Steps (5 minutes)

### Step 1: Go to Repository Settings
1. Navigate to: https://github.com/elvistranhere/job-hunter/settings/secrets/actions
2. You should see a page titled "Actions secrets and variables"

### Step 2: Add or Update EMAIL_TO Secret

**If EMAIL_TO already exists:**
1. Click the pencil icon next to `EMAIL_TO`
2. Replace the value with:
   ```
   khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com
   ```
3. Click "Update secret"

**If EMAIL_TO doesn't exist:**
1. Click "New repository secret"
2. Name: `EMAIL_TO`
3. Value: `khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com`
4. Click "Add secret"

**Important**: NO spaces after commas!

### Step 3: Verify Other Secrets Exist

Make sure these secrets are already configured:
- ✓ `GMAIL_USER` - The Gmail address that sends emails
- ✓ `GMAIL_APP_PASSWORD` - The Gmail app password

If they're missing, see the complete setup guide in [SETUP_EMAILS.md](./SETUP_EMAILS.md)

### Step 4: Trigger the Workflow

1. Go to: https://github.com/elvistranhere/job-hunter/actions/workflows/daily-scrape.yml
2. Click "Run workflow" button (right side)
3. Keep default settings:
   - Full run: Leave unchecked
   - Min score: 20 (default)
4. Click green "Run workflow" button
5. Wait 5-10 minutes

### Step 5: Verify Success

1. Check the workflow run status in Actions tab
2. All 3 recipients should receive the job digest email
3. Check spam folders if email not in inbox
4. View workflow logs for confirmation message

## What Happens Next

- The workflow will run automatically every day at 9 PM UTC (~7 AM Adelaide time)
- All three recipients will receive the daily job digest
- The email includes top jobs, notable companies, and remote positions

## Need Help?

See the complete guide in **[SETUP_EMAILS.md](./SETUP_EMAILS.md)** for:
- Detailed screenshots and explanations
- Troubleshooting common issues
- How to create Gmail App Passwords
- Local testing instructions

## Summary of Code Changes

I've made these documentation updates:
1. ✅ Created `SETUP_EMAILS.md` - Complete setup guide
2. ✅ Updated `.env.example` - Shows the new email format
3. ✅ Updated `CLAUDE.md` - Added email setup section

The actual email configuration must be done through GitHub's web UI (secrets cannot be modified via code for security reasons).
