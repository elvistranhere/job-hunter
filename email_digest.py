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
import json
import os
import smtplib
import sys
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


# ── Design tokens ───────────────────────────────────────────────────────────
# Light mode is the default (inline styles — works in all email clients).
# Dark mode activates via @media (prefers-color-scheme: dark) for Apple Mail,
# Gmail mobile, and other supporting clients.

# Light mode palette
L_BG = "#ffffff"
L_CARD = "#f8fafc"
L_CARD_ALT = "#f1f5f9"
L_BORDER = "#e2e8f0"
L_TEXT = "#0f172a"
L_TEXT_SECONDARY = "#334155"
L_TEXT_MUTED = "#64748b"
L_TEXT_FAINT = "#94a3b8"

# Dark mode palette (navy theme)
D_BG = "#060a14"
D_CARD = "#0a0f1c"
D_CARD_ALT = "#111827"
D_BORDER = "#1a2332"
D_TEXT = "#e8ecf2"
D_TEXT_SECONDARY = "#cbd5e1"
D_TEXT_MUTED = "#64748b"
D_TEXT_FAINT = "#475569"

# Accent colors (same in both modes)
AMBER_600 = "#d97706"
AMBER_500 = "#f59e0b"
AMBER_400 = "#fbbf24"
AMBER_300 = "#fcd34d"

EMERALD_500 = "#10b981"
EMERALD_400 = "#34d399"
ROSE_500 = "#f43f5e"

TIER_COLORS = {
    "Big Tech": "#b45309",
    "Top Tech": "#0e7490",
    "AU Notable": "#7c3aed",
}

TIER_BG = {
    "Big Tech": "#fffbeb",
    "Top Tech": "#ecfeff",
    "AU Notable": "#f5f3ff",
}

TIER_COLORS_DARK = {
    "Big Tech": AMBER_400,
    "Top Tech": "#22d3ee",
    "AU Notable": "#a78bfa",
}

TIER_BG_DARK = {
    "Big Tech": "#1a1608",
    "Top Tech": "#081a1e",
    "AU Notable": "#12081e",
}

SENIORITY_COLORS = {
    "junior": ("#059669", "#ecfdf5"),
    "mid": ("#2563eb", "#eff6ff"),
    "senior": ("#d97706", "#fffbeb"),
    "lead": ("#e11d48", "#fff1f2"),
    "staff": ("#7c3aed", "#f5f3ff"),
    "director": ("#e11d48", "#fff1f2"),
    "executive": ("#64748b", "#f1f5f9"),
}

SENIORITY_COLORS_DARK = {
    "junior": ("#34d399", "#071a12"),
    "mid": ("#60a5fa", "#081220"),
    "senior": (AMBER_400, "#1a1608"),
    "lead": (ROSE_500, "#1a0810"),
    "staff": ("#a78bfa", "#12081e"),
    "director": ("#fb7185", "#1a0810"),
    "executive": ("#94a3b8", "#1a2332"),
}


# ── HTML rendering ───────────────────────────────────────────────────────────


def _esc(text) -> str:
    return html.escape(str(text)) if pd.notna(text) else ""


def _score_color(score: float) -> str:
    """Score badge text color (light mode)."""
    if score >= 60:
        return "#059669"
    if score >= 40:
        return "#b45309"
    if score >= 20:
        return "#2563eb"
    return L_TEXT_MUTED


def _score_bg(score: float) -> str:
    """Score badge background (light mode)."""
    if score >= 60:
        return "#ecfdf5"
    if score >= 40:
        return "#fffbeb"
    if score >= 20:
        return "#eff6ff"
    return L_CARD_ALT


def _render_job_card(row: pd.Series) -> str:
    seniority = str(row.get("seniority", "mid"))
    sen_fg, sen_bg = SENIORITY_COLORS.get(seniority, (L_TEXT_MUTED, L_CARD_ALT))
    score = float(row.get("score", 0))
    sc = _score_color(score)
    sc_bg = _score_bg(score)
    tier = str(row.get("tier", "")) if pd.notna(row.get("tier")) else ""

    tier_html = ""
    if tier:
        t_fg = TIER_COLORS.get(tier, AMBER_600)
        t_bg = TIER_BG.get(tier, L_CARD_ALT)
        tier_html = f'<span class="tier-badge" style="background:{t_bg};color:{t_fg};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-left:6px;">{_esc(tier)}</span>'

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
    date_html = f'<span style="color:{L_TEXT_MUTED};font-size:11px;">{date}</span>' if date and date != "nan" else ""

    if direct_url and scraped_url != "#":
        via_html = f'<a href="{scraped_url}" style="color:{L_TEXT_MUTED};font-size:11px;text-decoration:underline;" target="_blank">via {site}</a>'
    else:
        via_html = f'<span style="color:{L_TEXT_FAINT};font-size:11px;">{site}</span>'

    salary = _esc(row.get("salary", ""))
    salary_html = (
        f'<div style="color:{EMERALD_500};font-size:12px;margin-top:4px;font-weight:500;">{salary}</div>'
        if salary and salary != "nan"
        else ""
    )

    work_type = _esc(row.get("work_type", ""))
    work_arr = _esc(row.get("work_arrangement", ""))
    meta_parts = [m for m in [work_type, work_arr] if m and m != "nan"]
    meta_html = (
        f'<span style="color:{L_TEXT_FAINT};font-size:11px;">{" · ".join(meta_parts)}</span>' if meta_parts else ""
    )

    return f"""<tr><td class="job-card" style="padding:16px 20px;border-bottom:1px solid {L_BORDER};">
  <table role="presentation" style="width:100%;"><tr>
    <td style="width:48px;vertical-align:top;padding-right:12px;">
      <div class="score-badge" style="background:{sc_bg};color:{sc};font-size:16px;font-weight:700;width:44px;height:44px;line-height:44px;text-align:center;border-radius:8px;">{score:.0f}</div>
    </td>
    <td style="vertical-align:top;">
      <a href="{primary_url}" class="job-title" style="color:{L_TEXT};font-weight:600;font-size:15px;text-decoration:none;" target="_blank">{title}</a>
      <div style="margin-top:4px;">
        <span class="company-name" style="color:{L_TEXT_SECONDARY};font-weight:500;font-size:13px;">{company}</span>{tier_html}
      </div>
      <div class="job-meta" style="margin-top:4px;color:{L_TEXT_MUTED};font-size:12px;">
        {location}
        {f'<span style="margin:0 6px;color:{L_TEXT_FAINT};">·</span>' if location else ""}
        {via_html}
        {f'<span style="margin:0 6px;color:{L_TEXT_FAINT};">·</span>' + date_html if date_html else ""}
        {f'<span style="margin:0 6px;color:{L_TEXT_FAINT};">·</span>' + meta_html if meta_html else ""}
      </div>
      {salary_html}
      <div style="margin-top:6px;">
        <span class="sen-badge" style="background:{sen_bg};color:{sen_fg};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;">{seniority}</span>
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
        fg, _bg = SENIORITY_COLORS.get(level, (L_TEXT_MUTED, L_CARD_ALT))
        bar_width = max(int(pct * 2), 8)
        rows.append(f"""<tr>
  <td style="padding:6px 8px;font-size:12px;color:{fg};font-weight:500;width:70px;text-transform:capitalize;">{level}</td>
  <td style="padding:6px 8px;">
    <div style="background:{fg};border-radius:3px;height:8px;width:{bar_width}px;display:inline-block;opacity:0.7;vertical-align:middle;"></div>
    <span class="bar-count" style="font-size:11px;color:{L_TEXT_MUTED};margin-left:8px;">{count} ({pct:.0f}%)</span>
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

    # Dark mode CSS — overrides light mode inline styles for Apple Mail, Gmail mobile, etc.
    dark_css = f"""
    @media (prefers-color-scheme: dark) {{
      .email-body {{ background-color: {D_BG} !important; }}
      .email-wrapper {{ background-color: {D_CARD} !important; }}
      .header-title {{ color: #ffffff !important; }}
      .header-date {{ color: {D_TEXT_MUTED} !important; }}
      .stat-card {{ background-color: {D_CARD_ALT} !important; }}
      .stat-value {{ color: #ffffff !important; }}
      .stat-label {{ color: {D_TEXT_MUTED} !important; }}
      .sites-summary {{ color: {D_TEXT_FAINT} !important; }}
      .section-border {{ border-color: {D_BORDER} !important; }}
      .job-card {{ border-color: {D_BORDER} !important; }}
      .job-title {{ color: {D_TEXT} !important; }}
      .company-name {{ color: #ffffff !important; }}
      .job-meta {{ color: {D_TEXT_MUTED} !important; }}
      .bar-count {{ color: {D_TEXT_MUTED} !important; }}
      .footer-text {{ color: {D_TEXT_FAINT} !important; }}
      .footer-sub {{ color: {D_TEXT_FAINT} !important; }}
    }}
    """

    # Email wrapper — light mode default
    parts.append(f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style type="text/css">
  :root {{ color-scheme: light dark; supported-color-schemes: light dark; }}
  {dark_css}
</style>
</head>
<body class="email-body" style="margin:0;padding:0;background:{L_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','DM Sans',Roboto,sans-serif;color:{L_TEXT};">
<table role="presentation" class="email-wrapper" style="width:100%;max-width:640px;margin:0 auto;background:{L_BG};">""")

    # Header — amber accent bar
    parts.append(f"""<tr><td style="padding:0;">
  <div style="height:3px;background:linear-gradient(90deg,{AMBER_600},{AMBER_400},{AMBER_600});"></div>
  <table role="presentation" style="width:100%;padding:28px 24px 20px;">
    <tr>
      <td>
        <h1 class="header-title" style="margin:0;color:{L_TEXT};font-size:24px;font-weight:400;font-style:italic;letter-spacing:-0.5px;">Job Hunter</h1>
        <p class="header-date" style="margin:4px 0 0;color:{L_TEXT_MUTED};font-size:13px;letter-spacing:0.5px;">DAILY DIGEST · {today.upper()}</p>
      </td>
    </tr>
  </table>
</td></tr>""")

    # Stats bar — 4 metric cards
    sites_summary = " · ".join(f"{s} ({c})" for s, c in sites.items())
    parts.append(f"""<tr><td style="padding:0 20px 16px;">
  <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px 0;">
    <tr>
      <td class="stat-card" style="background:{L_CARD};border-radius:8px;padding:12px;text-align:center;width:25%;">
        <div class="stat-value" style="font-size:24px;font-weight:700;color:{L_TEXT};">{total}</div>
        <div class="stat-label" style="font-size:10px;color:{L_TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Jobs Found</div>
      </td>
      <td class="stat-card" style="background:{L_CARD};border-radius:8px;padding:12px;text-align:center;width:25%;">
        <div style="font-size:24px;font-weight:700;color:{EMERALD_500};">{top_score:.0f}</div>
        <div class="stat-label" style="font-size:10px;color:{L_TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Top Score</div>
      </td>
      <td class="stat-card" style="background:{L_CARD};border-radius:8px;padding:12px;text-align:center;width:25%;">
        <div style="font-size:24px;font-weight:700;color:{AMBER_600};">{notable_count}</div>
        <div class="stat-label" style="font-size:10px;color:{L_TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Notable</div>
      </td>
      <td class="stat-card" style="background:{L_CARD};border-radius:8px;padding:12px;text-align:center;width:25%;">
        <div style="font-size:24px;font-weight:700;color:#2563eb;">{len(top_jobs)}</div>
        <div class="stat-label" style="font-size:10px;color:{L_TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">In Digest</div>
      </td>
    </tr>
  </table>
  <div class="sites-summary" style="text-align:center;margin-top:8px;font-size:11px;color:{L_TEXT_FAINT};">{sites_summary}</div>
</td></tr>""")

    # Section: Top Jobs
    parts.append(f"""<tr><td style="padding:8px 20px 0;">
  <table role="presentation" style="width:100%;"><tr>
    <td style="padding-bottom:8px;">
      <span style="color:{AMBER_600};font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Top Jobs</span>
      <span style="color:{L_TEXT_FAINT};font-size:12px;margin-left:8px;">score &ge; {min_score:.0f}</span>
    </td>
  </tr></table>
  <div class="section-border" style="height:1px;background:linear-gradient(90deg,{AMBER_500},{L_BORDER});"></div>
</td></tr>""")

    parts.append('<tr><td><table role="presentation" style="width:100%;">')
    for _, row in top_jobs.iterrows():
        parts.append(_render_job_card(row))
    parts.append("</table></td></tr>")

    # Section: Notable Companies
    if not notable.empty:
        parts.append(f"""<tr><td style="padding:20px 20px 0;">
  <table role="presentation" style="width:100%;"><tr>
    <td style="padding-bottom:8px;">
      <span style="color:#7c3aed;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Notable Companies</span>
    </td>
  </tr></table>
  <div class="section-border" style="height:1px;background:linear-gradient(90deg,#7c3aed,{L_BORDER});"></div>
</td></tr>""")
        parts.append('<tr><td><table role="presentation" style="width:100%;">')
        for _, row in notable.iterrows():
            parts.append(_render_job_card(row))
        parts.append("</table></td></tr>")

    # Section: Remote Jobs
    if not remote.empty:
        parts.append(f"""<tr><td style="padding:20px 20px 0;">
  <table role="presentation" style="width:100%;"><tr>
    <td style="padding-bottom:8px;">
      <span style="color:#0e7490;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Remote Jobs</span>
    </td>
  </tr></table>
  <div class="section-border" style="height:1px;background:linear-gradient(90deg,#0e7490,{L_BORDER});"></div>
</td></tr>""")
        parts.append('<tr><td><table role="presentation" style="width:100%;">')
        for _, row in remote.iterrows():
            parts.append(_render_job_card(row))
        parts.append("</table></td></tr>")

    # Seniority breakdown
    seniority_rows = _render_seniority_bar(df)
    if seniority_rows:
        parts.append(f"""<tr><td style="padding:20px 20px 0;">
  <table role="presentation" style="width:100%;"><tr>
    <td style="padding-bottom:8px;">
      <span style="color:{EMERALD_500};font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Seniority Breakdown</span>
    </td>
  </tr></table>
  <div class="section-border" style="height:1px;background:linear-gradient(90deg,{EMERALD_500},{L_BORDER});"></div>
</td></tr>
<tr><td style="padding:8px 20px 16px;">
  <table role="presentation" style="width:100%;">{seniority_rows}</table>
</td></tr>""")

    # Footer
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    parts.append(f"""<tr><td style="padding:24px 20px;border-top:1px solid {L_BORDER};">
  <table role="presentation" style="width:100%;"><tr>
    <td style="text-align:center;">
      <p class="footer-text" style="margin:0;font-size:12px;color:{L_TEXT_MUTED};font-style:italic;">Job Hunter</p>
      <p class="footer-sub" style="margin:6px 0 0;font-size:11px;color:{L_TEXT_FAINT};">Score threshold: {min_score:.0f} · {len(top_jobs)} of {total} jobs · {ts}</p>
      <p class="footer-sub" style="margin:8px 0 0;font-size:11px;color:{L_TEXT_FAINT};">Open source · github.com/elvistranhere/job-hunter</p>
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


def _read_profile_min_score(profile_path: str) -> float | None:
    """Read minScore from a profile.json file. Returns None if unavailable."""
    try:
        data = json.loads(Path(profile_path).read_text(encoding="utf-8"))
        return float(data.get("minScore", 20))
    except (FileNotFoundError, json.JSONDecodeError, TypeError, ValueError):
        return None


def main():
    parser = argparse.ArgumentParser(description="Send Job Hunter email digest")
    parser.add_argument("csv_path", nargs="?", help="Path to ranked jobs CSV (default: latest in jobs/)")
    parser.add_argument("--profile", type=str, default="profile.json", help="Path to profile JSON (reads minScore)")
    parser.add_argument("--min-score", type=float, default=None, help="Override minimum score (default: from profile)")
    parser.add_argument("--dry-run", action="store_true", help="Render HTML preview, don't send email")
    parser.add_argument("--to", type=str, help="Override recipient email")
    args = parser.parse_args()

    _load_dotenv()

    # Resolve min_score: CLI flag > profile.json > default 20
    if args.min_score is not None:
        min_score = args.min_score
    else:
        profile_min = _read_profile_min_score(args.profile)
        min_score = profile_min if profile_min is not None else 20.0

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
    email_html = render_email_html(df, min_score=min_score)
    above_threshold = len(df[df["score"] >= min_score])

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

    if not send_email(subject, email_html, to=args.to):
        sys.exit(1)


if __name__ == "__main__":
    main()
