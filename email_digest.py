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


# ── Design tokens (matches web app) ─────────────────────────────────────────

NAVY_950 = "#060a14"
NAVY_900 = "#0a0f1c"
NAVY_800 = "#111827"
NAVY_700 = "#1a2332"
NAVY_600 = "#243044"
NAVY_500 = "#334155"
NAVY_400 = "#475569"
NAVY_300 = "#64748b"
NAVY_200 = "#94a3b8"
NAVY_100 = "#cbd5e1"
NAVY_50 = "#e8ecf2"

AMBER_600 = "#d97706"
AMBER_500 = "#f59e0b"
AMBER_400 = "#fbbf24"
AMBER_300 = "#fcd34d"

EMERALD_500 = "#10b981"
EMERALD_400 = "#34d399"
ROSE_500 = "#f43f5e"

TIER_COLORS = {
    "Big Tech": AMBER_400,
    "Top Tech": "#22d3ee",
    "AU Notable": "#a78bfa",
}

TIER_BG = {
    "Big Tech": "#1a1608",
    "Top Tech": "#081a1e",
    "AU Notable": "#12081e",
}

SENIORITY_COLORS = {
    "junior": (EMERALD_400, "#071a12"),
    "mid": ("#60a5fa", "#081220"),
    "senior": (AMBER_400, "#1a1608"),
    "lead": (ROSE_500, "#1a0810"),
    "staff": ("#a78bfa", "#12081e"),
    "director": ("#fb7185", "#1a0810"),
    "executive": (NAVY_200, NAVY_700),
}


# ── HTML rendering ───────────────────────────────────────────────────────────

def _esc(text) -> str:
    return html.escape(str(text)) if pd.notna(text) else ""


def _score_color(score: float) -> str:
    if score >= 60:
        return EMERALD_400
    if score >= 40:
        return AMBER_400
    if score >= 20:
        return "#60a5fa"
    return NAVY_300


def _score_bg(score: float) -> str:
    if score >= 60:
        return "#071a12"
    if score >= 40:
        return "#1a1608"
    if score >= 20:
        return "#081220"
    return NAVY_700


def _render_job_card(row: pd.Series) -> str:
    seniority = str(row.get("seniority", "mid"))
    sen_fg, sen_bg = SENIORITY_COLORS.get(seniority, (NAVY_300, NAVY_700))
    score = float(row.get("score", 0))
    sc = _score_color(score)
    sc_bg = _score_bg(score)
    tier = str(row.get("tier", "")) if pd.notna(row.get("tier")) else ""

    tier_html = ""
    if tier:
        t_fg = TIER_COLORS.get(tier, AMBER_400)
        t_bg = TIER_BG.get(tier, NAVY_700)
        tier_html = f'<span style="background:{t_bg};color:{t_fg};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-left:6px;">{_esc(tier)}</span>'

    title = _esc(row.get("title", "Unknown"))
    raw_direct = row.get("job_url_direct")
    has_direct = pd.notna(raw_direct) and str(raw_direct).startswith("http")
    direct_url = str(raw_direct) if has_direct else None
    scraped_url = str(row.get("job_url", "#"))
    primary_url = direct_url or scraped_url
    company = _esc(row.get("company", ""))
    location = _esc(row.get("location", ""))
    site = _esc(row.get("site", ""))
    date = _esc(row.get("date_posted", ""))
    date_html = f'<span style="color:{NAVY_300};font-size:11px;">{date}</span>' if date and date != "nan" else ""

    if direct_url and scraped_url != "#":
        via_html = f'<a href="{scraped_url}" style="color:{NAVY_300};font-size:11px;text-decoration:underline;" target="_blank">via {site}</a>'
    else:
        via_html = f'<span style="color:{NAVY_400};font-size:11px;">{site}</span>'

    salary = _esc(row.get("salary", ""))
    salary_html = f'<div style="color:{EMERALD_400};font-size:12px;margin-top:4px;font-weight:500;">{salary}</div>' if salary and salary != "nan" else ""

    work_type = _esc(row.get("work_type", ""))
    work_arr = _esc(row.get("work_arrangement", ""))
    meta_parts = [m for m in [work_type, work_arr] if m and m != "nan"]
    meta_html = f'<span style="color:{NAVY_400};font-size:11px;">{" · ".join(meta_parts)}</span>' if meta_parts else ""

    return f"""<tr><td style="padding:16px 20px;border-bottom:1px solid {NAVY_700};">
  <table role="presentation" style="width:100%;"><tr>
    <td style="width:48px;vertical-align:top;padding-right:12px;">
      <div style="background:{sc_bg};color:{sc};font-size:16px;font-weight:700;width:44px;height:44px;line-height:44px;text-align:center;border-radius:8px;">{score:.0f}</div>
    </td>
    <td style="vertical-align:top;">
      <a href="{primary_url}" style="color:{NAVY_50};font-weight:600;font-size:15px;text-decoration:none;" target="_blank">{title}</a>
      <div style="margin-top:4px;">
        <span style="color:#ffffff;font-weight:500;font-size:13px;">{company}</span>{tier_html}
      </div>
      <div style="margin-top:4px;color:{NAVY_300};font-size:12px;">
        {location}
        {f'<span style="margin:0 6px;color:{NAVY_500};">·</span>' if location else ''}
        {via_html}
        {f'<span style="margin:0 6px;color:{NAVY_500};">·</span>' + date_html if date_html else ''}
        {f'<span style="margin:0 6px;color:{NAVY_500};">·</span>' + meta_html if meta_html else ''}
      </div>
      {salary_html}
      <div style="margin-top:6px;">
        <span style="background:{sen_bg};color:{sen_fg};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;">{seniority}</span>
      </div>
    </td>
  </tr></table>
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
        fg, bg = SENIORITY_COLORS.get(level, (NAVY_300, NAVY_700))
        bar_width = max(int(pct * 2), 8)
        rows.append(f"""<tr>
  <td style="padding:6px 8px;font-size:12px;color:{fg};font-weight:500;width:70px;text-transform:capitalize;">{level}</td>
  <td style="padding:6px 8px;">
    <div style="background:{fg};border-radius:3px;height:8px;width:{bar_width}px;display:inline-block;opacity:0.7;vertical-align:middle;"></div>
    <span style="font-size:11px;color:{NAVY_300};margin-left:8px;">{count} ({pct:.0f}%)</span>
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
    sites = df["site"].value_counts().to_dict() if "site" in df.columns else {}

    parts = []

    # Email wrapper — dark background
    parts.append(f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:{NAVY_950};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','DM Sans',Roboto,sans-serif;color:{NAVY_100};">
<table role="presentation" style="width:100%;max-width:640px;margin:0 auto;background:{NAVY_900};">""")

    # Header — amber accent bar
    parts.append(f"""<tr><td style="padding:0;">
  <div style="height:3px;background:linear-gradient(90deg,{AMBER_600},{AMBER_400},{AMBER_600});"></div>
  <table role="presentation" style="width:100%;padding:28px 24px 20px;">
    <tr>
      <td>
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:400;font-style:italic;letter-spacing:-0.5px;">Job Hunter</h1>
        <p style="margin:4px 0 0;color:{NAVY_300};font-size:13px;letter-spacing:0.5px;">DAILY DIGEST · {today.upper()}</p>
      </td>
    </tr>
  </table>
</td></tr>""")

    # Stats bar — 4 metric cards
    sites_summary = " · ".join(f"{s} ({c})" for s, c in list(sites.items())[:4])
    parts.append(f"""<tr><td style="padding:0 20px 16px;">
  <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px 0;">
    <tr>
      <td style="background:{NAVY_800};border-radius:8px;padding:12px;text-align:center;width:25%;">
        <div style="font-size:24px;font-weight:700;color:#ffffff;">{total}</div>
        <div style="font-size:10px;color:{NAVY_300};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Jobs Found</div>
      </td>
      <td style="background:{NAVY_800};border-radius:8px;padding:12px;text-align:center;width:25%;">
        <div style="font-size:24px;font-weight:700;color:{EMERALD_400};">{top_score:.0f}</div>
        <div style="font-size:10px;color:{NAVY_300};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Top Score</div>
      </td>
      <td style="background:{NAVY_800};border-radius:8px;padding:12px;text-align:center;width:25%;">
        <div style="font-size:24px;font-weight:700;color:{AMBER_400};">{notable_count}</div>
        <div style="font-size:10px;color:{NAVY_300};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Notable</div>
      </td>
      <td style="background:{NAVY_800};border-radius:8px;padding:12px;text-align:center;width:25%;">
        <div style="font-size:24px;font-weight:700;color:#60a5fa;">{len(top_jobs)}</div>
        <div style="font-size:10px;color:{NAVY_300};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">In Digest</div>
      </td>
    </tr>
  </table>
  <div style="text-align:center;margin-top:8px;font-size:11px;color:{NAVY_400};">{sites_summary}</div>
</td></tr>""")

    # Section: Top Jobs
    parts.append(f"""<tr><td style="padding:8px 20px 0;">
  <table role="presentation" style="width:100%;"><tr>
    <td style="padding-bottom:8px;">
      <span style="color:{AMBER_400};font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Top Jobs</span>
      <span style="color:{NAVY_400};font-size:12px;margin-left:8px;">score &ge; {min_score:.0f}</span>
    </td>
  </tr></table>
  <div style="height:1px;background:linear-gradient(90deg,{AMBER_500},{NAVY_800});"></div>
</td></tr>""")

    parts.append(f'<tr><td style="background:{NAVY_900};"><table role="presentation" style="width:100%;">')
    for _, row in top_jobs.iterrows():
        parts.append(_render_job_card(row))
    parts.append("</table></td></tr>")

    # Section: Notable Companies
    if not notable.empty:
        parts.append(f"""<tr><td style="padding:20px 20px 0;">
  <table role="presentation" style="width:100%;"><tr>
    <td style="padding-bottom:8px;">
      <span style="color:#a78bfa;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Notable Companies</span>
    </td>
  </tr></table>
  <div style="height:1px;background:linear-gradient(90deg,#a78bfa,{NAVY_800});"></div>
</td></tr>""")
        parts.append(f'<tr><td style="background:{NAVY_900};"><table role="presentation" style="width:100%;">')
        for _, row in notable.iterrows():
            parts.append(_render_job_card(row))
        parts.append("</table></td></tr>")

    # Section: Remote Jobs
    if not remote.empty:
        parts.append(f"""<tr><td style="padding:20px 20px 0;">
  <table role="presentation" style="width:100%;"><tr>
    <td style="padding-bottom:8px;">
      <span style="color:#22d3ee;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Remote Jobs</span>
    </td>
  </tr></table>
  <div style="height:1px;background:linear-gradient(90deg,#22d3ee,{NAVY_800});"></div>
</td></tr>""")
        parts.append(f'<tr><td style="background:{NAVY_900};"><table role="presentation" style="width:100%;">')
        for _, row in remote.iterrows():
            parts.append(_render_job_card(row))
        parts.append("</table></td></tr>")

    # Seniority breakdown
    seniority_rows = _render_seniority_bar(df)
    if seniority_rows:
        parts.append(f"""<tr><td style="padding:20px 20px 0;">
  <table role="presentation" style="width:100%;"><tr>
    <td style="padding-bottom:8px;">
      <span style="color:{EMERALD_400};font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Seniority Breakdown</span>
    </td>
  </tr></table>
  <div style="height:1px;background:linear-gradient(90deg,{EMERALD_500},{NAVY_800});"></div>
</td></tr>
<tr><td style="padding:8px 20px 16px;">
  <table role="presentation" style="width:100%;">{seniority_rows}</table>
</td></tr>""")

    # Footer
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    parts.append(f"""<tr><td style="padding:24px 20px;border-top:1px solid {NAVY_700};">
  <table role="presentation" style="width:100%;"><tr>
    <td style="text-align:center;">
      <p style="margin:0;font-size:12px;color:{NAVY_400};font-style:italic;">Job Hunter</p>
      <p style="margin:6px 0 0;font-size:11px;color:{NAVY_500};">Score threshold: {min_score:.0f} · {len(top_jobs)} of {total} jobs · {ts}</p>
      <p style="margin:8px 0 0;font-size:11px;color:{NAVY_500};">Open source · github.com/elvistran/job-hunter</p>
    </td>
  </tr></table>
</td></tr>""")

    parts.append("</table></body></html>")
    return "\n".join(parts)


# ── SMTP sending ─────────────────────────────────────────────────────────────

def send_email(subject: str, html_body: str, to: str | None = None) -> bool:
    """Send HTML email via Gmail SMTP. Supports comma-separated recipients. Returns True on success."""
    gmail_user = os.environ.get("GMAIL_USER")
    gmail_password = os.environ.get("GMAIL_APP_PASSWORD")
    to = to or os.environ.get("EMAIL_TO", gmail_user)

    if not gmail_user or not gmail_password:
        print("Error: GMAIL_USER and GMAIL_APP_PASSWORD must be set (in .env or environment)")
        return False
    if not to:
        print("Error: EMAIL_TO must be set")
        return False

    # Support comma-separated recipients
    recipients = [addr.strip() for addr in to.split(",") if addr.strip()]

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Job Hunter <{gmail_user}>"
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, gmail_password)
            server.sendmail(gmail_user, recipients, msg.as_string())
        print(f"  Email sent to {', '.join(recipients)}")
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
