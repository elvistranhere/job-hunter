---
name: linkedin-easy-apply
description: >
  Automate LinkedIn Easy Apply job applications using Playwright MCP browser tools.
  Use when the user wants to apply for a job on LinkedIn, says "apply to this job",
  "easy apply", "submit application", or provides a LinkedIn job URL and wants to apply.
  Requires: Playwright MCP browser tools, LinkedIn cookies, resume file path, and job URL.
---

# LinkedIn Easy Apply Automation

Apply to LinkedIn jobs via Easy Apply using Playwright MCP browser tools.

## Required Inputs

Collect these from the user before starting:

| Input | Required | Description |
|-------|----------|-------------|
| **Job URL** | Yes | LinkedIn job posting URL (e.g. `linkedin.com/jobs/view/...`) |
| **Resume path** | Yes | Absolute path to PDF resume file |
| **LinkedIn cookies** | Yes | `li_at` and `JSESSIONID` cookie values for auth |
| **Location** | No | Override contact location (default: use profile's existing) |
| **Cover letter mode** | No | `auto` / `custom` / `skip` (default: ask user) |
| **Auto-submit** | No | `true` = verify then submit; `false` = pause at Review (default: `false`) |

## Workflow

### 1. Authenticate

Inject LinkedIn cookies via Playwright:

```javascript
async (page) => {
  const cookies = [
    { name: 'li_at', value: '<LI_AT_VALUE>', domain: '.linkedin.com', path: '/' },
    { name: 'JSESSIONID', value: '<JSESSIONID_VALUE>', domain: '.linkedin.com', path: '/' }
  ];
  await page.context().addCookies(cookies);
}
```

### 2. Navigate & Open Easy Apply

1. Navigate to the job URL
2. Wait for `networkidle`
3. Take a snapshot to find the "Easy Apply" button
4. Click "Easy Apply" to open the dialog

### 3. Step-by-step Form Completion

LinkedIn Easy Apply has a multi-step dialog. Each step has a progress indicator.

**Step: Contact Info (~0-25%)**
- Fields are pre-filled from LinkedIn profile
- If `location` param provided, clear and fill the location field
- Click "Continue to next step"

**Step: Resume (~25%)**
- Take snapshot to find resume list
- Look for `generic "Select this resume"` containers with the target resume filename
- If resume not in list: click "Upload resume" button, use `browser_file_upload` with the resume path
- Click the `generic "Select this resume"` container (NOT the radio directly — download buttons intercept radio clicks)
- Verify selection: snapshot should show `generic "Selected"` and `radio ... [checked]`
- Handle cover letter based on mode:
  - `auto`: Generate a tailored cover letter mentioning company name, role title, and relevant skills
  - `custom`: Ask user for text
  - `skip`: Leave existing or clear
- Click "Continue to next step"

**Step: Work Experience (~50%)**
- Pre-filled from LinkedIn profile — review but don't modify
- Click "Continue to next step"

**Step: Education (~75%)**
- Pre-filled from LinkedIn profile — review but don't modify
- Click "Review your application"

### 4. Review & Submit

At the Review step (100% progress):

**If auto-submit is `false` (default):**
- Extract and display the full application summary to user
- Wait for user confirmation before clicking "Submit application"

**If auto-submit is `true`:**
- Run verification loop:
  1. Extract application summary from snapshot
  2. Verify resume filename matches the requested resume
  3. Verify contact email is present
  4. Verify cover letter is not empty (if cover letter mode was `auto` or `custom`)
  5. Verify at least 1 work experience entry exists
  6. If ANY check fails: pause and alert user instead of submitting
  7. If ALL checks pass: click "Submit application"
- After submit: verify confirmation dialog appears with "Application sent"

### 5. Confirm

- Look for `dialog "Application sent"` in snapshot
- Click "Done" to close
- Report success to user

## Critical Gotchas

- **Snapshot too large**: LinkedIn pages produce huge snapshots. Use `Grep` on saved snapshot files or targeted `browser_run_code` to find elements instead of reading full snapshots.
- **Resume radio buttons**: NEVER click radio buttons directly — download buttons overlay them and intercept clicks. Always click the parent `generic "Select this resume"` container.
- **Refs go stale**: After any navigation, file upload, or dialog state change, refs from previous snapshots are invalid. Always re-snapshot.
- **Dialog DOM isolation**: `page.evaluate()` with `document.querySelector` cannot find elements inside LinkedIn's Easy Apply dialog. Use Playwright's accessibility snapshot refs or locators instead.
- **Cover letter field**: The textbox is `role="textbox"` with name "Cover letter". Use `fill()` (not `type()`) to replace existing content.
- **Additional questions**: Some jobs have extra question steps (e.g. "How many years of experience?"). If an unexpected step appears between Education and Review, take a snapshot, identify the form fields, and fill them appropriately.

## Auto-Generated Cover Letter Template

When cover letter mode is `auto`, generate a concise cover letter (~100-150 words):

```
Dear [Company] Hiring Team,

I am excited to apply for the [Job Title] position. As a [degree/background] from [university],
I bring hands-on experience with [2-3 relevant skills from resume].

[1 sentence about relevant experience from work history].
I am passionate about [relevant domain] and thrive in [remote/collaborative] environments.

I would love the opportunity to contribute to [Company]'s mission.

Best regards,
[Full Name]
```

Tailor skills and experience to match the job description visible on the page.
