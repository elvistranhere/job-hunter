"""
Email digest for Job Hunter — renders scored jobs as HTML email and sends via Gmail SMTP.

Usage:
    uv run python email_digest.py                     # auto-detect latest CSV, send email
    uv run python email_digest.py --dry-run           # render to jobs/email_preview.html
    uv run python email_digest.py --min-score 30      # higher threshold
    uv run python email_digest.py path/to/jobs.csv    # specific CSV
"""

import argparse
import html
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import pandas as pd


# ── Minimal .env loader (avoids python-dotenv dependency) ────────────────────

def _load_dotenv(path: str = ".env"):
    env_path = Path(path)
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


# ── Color schemes ────────────────────────────────────────────────────────────

SENIORITY_COLORS = {
    "junior": ("#059669", "#ecfdf5"),    # green
    "mid": ("#2563eb", "#eff6ff"),       # blue
    "senior": ("#d97706", "#fffbeb"),    # amber
    "lead": ("#dc2626", "#fef2f2"),      # red
    "staff": ("#7c3aed", "#f5f3ff"),     # purple
    "director": ("#be185d", "#fdf2f8"),  # pink
    "executive": ("#1f2937", "#f3f4f6"), # gray
}

TIER_COLORS = {
    "Big Tech": "#2563eb",
    "Top Tech": "#7c3aed",
    "AU Notable": "#059669",
}


# ── HTML rendering ───────────────────────────────────────────────────────────

def _esc(text) -> str:
    return html.escape(str(text)) if pd.notna(text) else ""


def _score_color(score: float) -> str:
    if score >= 50:
        return "#059669"
    if score >= 30:
        return "#2563eb"
    if score >= 15:
        return "#6b7280"
    return "#9ca3af"


def _render_job_card(row: pd.Series) -> str:
    seniority = str(row.get("seniority", "mid"))
    fg, bg = SENIORITY_COLORS.get(seniority, ("#6b7280", "#f3f4f6"))
    score = float(row.get("score", 0))
    sc = _score_color(score)
    tier = str(row.get("tier", "")) if pd.notna(row.get("tier")) else ""
    tier_html = f' <span style="color:{TIER_COLORS.get(tier, "#d97706")};font-size:12px;font-weight:600;">({_esc(tier)})</span>' if tier else ""

    title = _esc(row.get("title", "Unknown"))
    job_url = str(row.get("job_url", "#"))
    company = _esc(row.get("company", ""))
    location = _esc(row.get("location", ""))
    site = _esc(row.get("site", ""))
    date = _esc(row.get("date_posted", ""))
    date_html = f'<span style="color:#9ca3af;font-size:11px;margin-left:8px;">{date}</span>' if date and date != "nan" else ""

    salary = _esc(row.get("salary", ""))
    salary_html = f'<div style="color:#059669;font-size:12px;margin-top:2px;">{salary}</div>' if salary and salary != "nan" else ""

    work_type = _esc(row.get("work_type", ""))
    work_arr = _esc(row.get("work_arrangement", ""))
    meta_parts = [m for m in [work_type, work_arr] if m and m != "nan"]
    meta_html = f'<span style="color:#9ca3af;font-size:11px;margin-left:8px;">{" · ".join(meta_parts)}</span>' if meta_parts else ""

    return f"""<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
  <a href="{job_url}" style="color:#1d4ed8;font-weight:600;font-size:15px;text-decoration:none;" target="_blank">{title}</a>
  <div style="margin-top:4px;">
    <span style="font-weight:500;">{company}</span>{tier_html}
    <span style="color:#6b7280;margin-left:8px;">{location}</span>
  </div>
  {salary_html}
  <div style="margin-top:6px;">
    <span style="background:{bg};color:{fg};padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;">{seniority}</span>
    <span style="color:{sc};font-weight:700;font-size:14px;margin-left:8px;">{score:.0f} pts</span>
    <span style="color:#9ca3af;font-size:11px;margin-left:8px;">{site}</span>
    {date_html}
    {meta_html}
  </div>
</td></tr>"""


def _render_seniority_bar(df: pd.DataFrame) -> str:
    if "seniority" not in df.columns:
        return ""
    counts = df["seniority"].value_counts()
    total = len(df)
    rows = []
    for level in ["junior", "mid", "senior", "lead", "staff", "director", "executive"]:
        if level not in counts:
            continue
        count = counts[level]
        pct = count / total * 100
        fg, bg = SENIORITY_COLORS.get(level, ("#6b7280", "#f3f4f6"))
        bar_width = max(int(pct * 2), 4)
        rows.append(f"""<tr>
  <td style="padding:4px 8px;font-size:13px;color:{fg};font-weight:500;width:70px;">{level}</td>
  <td style="padding:4px 8px;">
    <div style="background:{bg};border-radius:4px;height:18px;width:{bar_width}px;display:inline-block;"></div>
    <span style="font-size:12px;color:#6b7280;margin-left:6px;">{count} ({pct:.0f}%)</span>
  </td>
</tr>""")
    return "\n".join(rows)


def render_email_html(df: pd.DataFrame, min_score: float = 20.0) -> str:
    """Render scored jobs DataFrame as a mobile-friendly HTML email."""
    today = datetime.now().strftime("%A, %d %b %Y")

    # Filter with fallback
    filtered = df[df["score"] >= min_score]
    if len(filtered) < 5:
        filtered = df[df["score"] >= max(min_score - 10, 0)]
    if len(filtered) < 5:
        filtered = df[df["score"] >= 0]

    top_jobs = filtered.sort_values("score", ascending=False)
    notable = df[df["tier"].fillna("") != ""].nlargest(15, "score") if "tier" in df.columns else pd.DataFrame()
    if "is_remote" in df.columns:
        remote_mask = df["is_remote"].map(lambda x: x is True or str(x).lower() == "true")
        remote = df[remote_mask].nlargest(15, "score")
    else:
        remote = pd.DataFrame()

    # Stats
    total = len(df)
    top_score = df["score"].max() if not df.empty else 0
    notable_count = len(notable)
    remote_count = len(remote)
    sen_counts = df["seniority"].value_counts().to_dict() if "seniority" in df.columns else {}
    sites = df["site"].value_counts().to_dict() if "site" in df.columns else {}

    # Build HTML
    parts = []

    # Email wrapper
    parts.append(f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;">""")

    # Header
    parts.append(f"""<tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px 20px;text-align:center;">
  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Job Hunter Daily Digest</h1>
  <p style="margin:6px 0 0;color:#93c5fd;font-size:14px;">{today}</p>
</td></tr>""")

    # Stats bar
    sites_summary = " | ".join(f"{s}: {c}" for s, c in list(sites.items())[:5])
    parts.append(f"""<tr><td style="background:#f8fafc;padding:14px 20px;border-bottom:2px solid #e2e8f0;">
  <table role="presentation" style="width:100%;"><tr>
    <td style="text-align:center;padding:4px;">
      <div style="font-size:22px;font-weight:700;color:#1e3a5f;">{total}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Total Jobs</div>
    </td>
    <td style="text-align:center;padding:4px;">
      <div style="font-size:22px;font-weight:700;color:#059669;">{top_score:.0f}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Top Score</div>
    </td>
    <td style="text-align:center;padding:4px;">
      <div style="font-size:22px;font-weight:700;color:#7c3aed;">{notable_count}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Notable Cos</div>
    </td>
    <td style="text-align:center;padding:4px;">
      <div style="font-size:22px;font-weight:700;color:#2563eb;">{len(top_jobs)}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">In Digest</div>
    </td>
  </tr></table>
  <div style="text-align:center;margin-top:6px;font-size:11px;color:#9ca3af;">{sites_summary}</div>
</td></tr>""")

    # Top Jobs section
    parts.append(f"""<tr><td style="padding:16px 20px 8px;">
  <h2 style="margin:0;font-size:16px;color:#1e3a5f;border-bottom:2px solid #2563eb;padding-bottom:6px;">
    Top Jobs <span style="font-weight:400;color:#6b7280;font-size:13px;">(score &ge; {min_score:.0f})</span>
  </h2>
</td></tr>""")

    parts.append('<tr><td><table role="presentation" style="width:100%;">')
    for _, row in top_jobs.iterrows():
        parts.append(_render_job_card(row))
    parts.append("</table></td></tr>")

    # Notable Companies section
    if not notable.empty:
        parts.append("""<tr><td style="padding:16px 20px 8px;">
  <h2 style="margin:0;font-size:16px;color:#1e3a5f;border-bottom:2px solid #7c3aed;padding-bottom:6px;">Notable Companies</h2>
</td></tr>""")
        parts.append('<tr><td><table role="presentation" style="width:100%;">')
        for _, row in notable.iterrows():
            parts.append(_render_job_card(row))
        parts.append("</table></td></tr>")

    # Remote Jobs section
    if not remote.empty:
        parts.append("""<tr><td style="padding:16px 20px 8px;">
  <h2 style="margin:0;font-size:16px;color:#1e3a5f;border-bottom:2px solid #0891b2;padding-bottom:6px;">Remote Jobs</h2>
</td></tr>""")
        parts.append('<tr><td><table role="presentation" style="width:100%;">')
        for _, row in remote.iterrows():
            parts.append(_render_job_card(row))
        parts.append("</table></td></tr>")

    # Seniority breakdown
    seniority_rows = _render_seniority_bar(df)
    if seniority_rows:
        parts.append(f"""<tr><td style="padding:16px 20px 8px;">
  <h2 style="margin:0;font-size:16px;color:#1e3a5f;border-bottom:2px solid #059669;padding-bottom:6px;">Seniority Breakdown</h2>
</td></tr>
<tr><td style="padding:8px 20px;">
  <table role="presentation" style="width:100%;">{seniority_rows}</table>
</td></tr>""")

    # Footer
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    parts.append(f"""<tr><td style="background:#f8fafc;padding:16px 20px;text-align:center;border-top:1px solid #e2e8f0;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">Generated by Job Hunter at {ts}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Score threshold: {min_score:.0f} | Showing {len(top_jobs)} of {total} jobs</p>
</td></tr>""")

    parts.append("</table></body></html>")
    return "\n".join(parts)


# ── SMTP sending ─────────────────────────────────────────────────────────────

def send_email(subject: str, html_body: str, to: str | None = None) -> bool:
    """Send HTML email via Gmail SMTP. Returns True on success."""
    gmail_user = os.environ.get("GMAIL_USER")
    gmail_password = os.environ.get("GMAIL_APP_PASSWORD")
    to = to or os.environ.get("EMAIL_TO", gmail_user)

    if not gmail_user or not gmail_password:
        print("Error: GMAIL_USER and GMAIL_APP_PASSWORD must be set (in .env or environment)")
        return False
    if not to:
        print("Error: EMAIL_TO must be set")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Job Hunter <{gmail_user}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, gmail_password)
            server.sendmail(gmail_user, [to], msg.as_string())
        print(f"  Email sent to {to}")
        return True
    except Exception as e:
        print(f"  Failed to send email: {e}")
        return False


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Send Job Hunter email digest")
    parser.add_argument("csv_path", nargs="?", help="Path to ranked jobs CSV (default: latest in jobs/)")
    parser.add_argument("--min-score", type=float, default=20.0, help="Minimum score threshold (default: 20)")
    parser.add_argument("--dry-run", action="store_true", help="Render HTML preview, don't send email")
    parser.add_argument("--to", type=str, help="Override recipient email")
    args = parser.parse_args()

    _load_dotenv()

    # Find CSV
    if args.csv_path:
        csv_path = Path(args.csv_path)
    else:
        jobs_dir = Path("jobs")
        csv_files = sorted(jobs_dir.glob("ranked-jobs_*.csv")) if jobs_dir.exists() else []
        if not csv_files:
            print("No CSV files found in jobs/. Run scrape.py first.")
            return
        csv_path = csv_files[-1]

    print(f"  Reading {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"  {len(df)} jobs loaded")

    # Render
    email_html = render_email_html(df, min_score=args.min_score)
    above_threshold = len(df[df["score"] >= args.min_score])

    if args.dry_run:
        preview_path = Path("jobs/email_preview.html")
        preview_path.parent.mkdir(exist_ok=True)
        preview_path.write_text(email_html)
        print(f"  Preview written to {preview_path}")
        return

    # Send
    today = datetime.now().strftime("%d %b %Y")
    subject = f"Job Hunter: {above_threshold} relevant jobs ({today})"

    if not above_threshold:
        subject = f"Job Hunter: No strong matches today ({today})"

    send_email(subject, email_html, to=args.to)


if __name__ == "__main__":
    main()
