# 🚀 QUICK START: Add Email Recipients

## What You Need to Do

Update the `EMAIL_TO` GitHub secret to include the new email addresses.

## Steps (2 minutes)

### 1. Open GitHub Secrets Settings
```
https://github.com/elvistranhere/job-hunter/settings/secrets/actions
```

### 2. Edit the EMAIL_TO Secret
Click **Edit** on `EMAIL_TO` and set the value to:
```
khoinguyenmai17102005@gmail.com,trunglamasia@gmail.com,tridung.190705@gmail.com
```

### 3. Test the Workflow
```
https://github.com/elvistranhere/job-hunter/actions/workflows/daily-scrape.yml
```
Click **Run workflow** → **Run workflow** (green button)

## ✅ Done!

The three recipients will now receive daily job digests at ~7am Adelaide time.

---

📖 **Detailed Guide**: See [SETUP_EMAIL_RECIPIENTS.md](./SETUP_EMAIL_RECIPIENTS.md) for full documentation

## Verify Secrets

Make sure you have these three secrets configured:
- ✅ `GMAIL_USER` - Sender email address
- ✅ `GMAIL_APP_PASSWORD` - Gmail app password
- ✅ `EMAIL_TO` - **← Update this one**

## What Happens Next?

1. **Automatic**: Daily at 9pm UTC (7am Adelaide)
2. **Searches**: 3 cities × 6 role types = 18 searches
3. **Filters**: Only jobs from last 24 hours
4. **Sends**: Email digest to all recipients with top 20+ jobs
