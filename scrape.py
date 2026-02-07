"""
Job Hunter - Scrape Australian jobs matched to your LaTeX resume.

Parses resume .tex files to extract skills/keywords, scrapes 5 job boards
across Adelaide/Sydney/Melbourne, then ranks results by company tier and
role fit.

Usage:
    uv run python scrape.py                     # Full run: all locations + roles
    uv run python scrape.py --hours 24          # Last 24 hours only
    uv run python scrape.py --big-tech          # Big tech filter only
    uv run python scrape.py --location Sydney   # Single location
    uv run python scrape.py --search "DevOps"   # Custom search override
    uv run python scrape.py --resume-dir ./resumes  # Custom resume path
"""

import argparse
import csv
import logging
import re
import unicodedata
from datetime import datetime
from pathlib import Path

import pandas as pd
from jobspy import scrape_jobs

from scrapers_au import scrape_au_sites, scrape_gradconnection

# Suppress noisy JobSpy/tls_client logs
logging.getLogger("JobSpy").setLevel(logging.WARNING)
logging.getLogger("tls_client").setLevel(logging.WARNING)

# ── Locations (priority order) ───────────────────────────────────────────────
LOCATIONS = ["Adelaide, Australia", "Sydney, Australia", "Melbourne, Australia"]

# ── Sites ────────────────────────────────────────────────────────────────────
SITES = ["indeed", "linkedin"]

# ── Company tiers ────────────────────────────────────────────────────────────
TIER_BIG_TECH = {
    "Google", "Meta", "Apple", "Amazon", "Microsoft", "Netflix",
    "Atlassian", "Canva", "Stripe", "Airbnb", "Uber", "Spotify",
    "Salesforce", "Adobe", "Oracle", "SAP", "IBM", "Intel", "Cisco",
    "Nvidia", "AMD", "Qualcomm", "Samsung", "Sony",
}

TIER_TOP_TECH = {
    "Shopify", "Cloudflare", "Vercel", "Supabase", "MongoDB",
    "Datadog", "Figma", "Notion", "Linear", "Anthropic", "OpenAI",
    "Coinbase", "Block", "Palantir", "Snowflake", "Databricks",
    "Twilio", "Okta", "HashiCorp", "Elastic", "Confluent",
    "Zoom", "Slack", "Dropbox", "Square", "Robinhood",
    "CrowdStrike", "Palo Alto Networks", "Splunk", "ServiceNow",
    "Workday", "HubSpot", "Airtable",
}

TIER_AU_NOTABLE = {
    "Atlassian", "Canva", "SafetyCulture", "Xero", "WiseTech Global",
    "Afterpay", "Zip Co", "Culture Amp", "Employment Hero", "Deputy",
    "Buildkite", "Envato", "Campaign Monitor", "Aconex", "Redbubble",
    "REA Group", "Seek", "Domain", "Carsales", "Nearmap",
    "Immutable", "Rokt", "GO1", "Eucalyptus", "Linktree",
    "Harrison.ai", "Baraja", "Morse Micro", "Stax", "Pendula",
    "Brighte", "Lendi", "Prospa", "Tyro", "Swyftx",
    "CommBank", "Commonwealth Bank", "NAB", "Westpac", "ANZ",
    "Telstra", "Optus", "TPG", "NBN",
    "BHP", "Rio Tinto", "Woodside",
    "Maptek", "Santos", "CSL", "Cochlear",
}

# ── Role search terms (priority order) ──────────────────────────────────────
ROLE_SEARCHES = [
    "Full Stack Developer",
    "Full Stack Engineer",
    "Frontend Developer React",
    "Backend Developer",
    "Software Engineer",
    "Web Developer",
    "AI Engineer",
]


# ─── Resume Parser ───────────────────────────────────────────────────────────

def parse_latex_resume(resume_dir: str | Path) -> dict:
    """Parse all .tex files in resume_dir and extract structured profile data."""
    resume_dir = Path(resume_dir)
    tex_files = list(resume_dir.rglob("*.tex"))

    if not tex_files:
        print(f"  No .tex files found in {resume_dir}")
        return {"skills": [], "titles": [], "keywords": []}

    all_text = ""
    for f in tex_files:
        all_text += f.read_text(errors="ignore") + "\n"

    skills = _extract_skills(all_text)
    titles = _extract_titles(all_text)
    keywords = _extract_keywords(all_text)

    print(f"  Parsed {len(tex_files)} .tex files")
    print(f"  Skills ({len(skills)}): {', '.join(sorted(skills)[:20])}...")
    print(f"  Titles ({len(titles)}): {', '.join(titles)}")

    return {"skills": skills, "titles": titles, "keywords": keywords}


def _extract_skills(text: str) -> set[str]:
    """Extract technical skills from cvskill blocks and item descriptions."""
    skills = set()

    # From \cvskill lines: \cvskill{Category}{skill1, skill2, ...}
    for m in re.finditer(r'\\cvskill\s*\{[^}]*\}\s*\{([^}]+)\}', text):
        for s in re.split(r'[,;]', m.group(1)):
            clean = s.strip().replace("\\#", "#").replace("\\&", "&")
            clean = re.sub(r'\\texttt\{([^}]+)\}', r'\1', clean)
            clean = re.sub(r'\\[a-zA-Z]+\{([^}]*)\}', r'\1', clean)
            clean = re.sub(r'[\\{}]', '', clean).strip()
            if clean and len(clean) > 1:
                skills.add(clean)

    # From technology lines in cventry: {TypeScript, React, ...}
    for m in re.finditer(r'\\cventry\s*\{([^}]+)\}', text):
        line = m.group(1)
        if any(kw in line.lower() for kw in ["typescript", "react", "python", "c#", "c++", "node", "sql", "django", ".net"]):
            for s in re.split(r'[,;/]', line):
                clean = re.sub(r'[\\{}]', '', s).strip()
                clean = clean.replace("C\\#", "C#")
                if clean and len(clean) > 1 and not clean.startswith('%'):
                    skills.add(clean)

    return skills


def _extract_titles(text: str) -> list[str]:
    """Extract job titles from cventry blocks."""
    titles = []
    # Pattern: \cventry{Job Title}{Company}... - first arg is title
    for m in re.finditer(r'\\cventry\s*\{([^}]+)\}\s*%?\s*(?:Job title|Job Title)?', text):
        title = m.group(1).strip()
        if any(kw in title.lower() for kw in ["engineer", "developer", "lead", "intern", "assistant", "evaluator"]):
            title = re.sub(r'[\\{}]', '', title).strip()
            if title and title not in titles:
                titles.append(title)
    return titles


def _extract_keywords(text: str) -> set[str]:
    """Extract relevant keywords from item descriptions."""
    keywords = set()
    tech_terms = [
        "react", "typescript", "javascript", "next.js", "nextjs", "node.js",
        "python", "django", ".net", "c#", "sql", "postgresql", "redis",
        "docker", "kubernetes", "aws", "gcp", "azure", "vercel",
        "tailwind", "vite", "zustand", "graphql", "rest api",
        "machine learning", "llm", "ai", "reinforcement learning",
        "browser-use", "agent", "agentic", "rl", "prompt engineering",
        "full-stack", "fullstack", "frontend", "backend", "devops",
        "git", "ci/cd", "github actions", "microservices",
        "capacitor", "expo", "mobile", "ios",
    ]

    text_lower = text.lower()
    for term in tech_terms:
        if term in text_lower:
            keywords.add(term)

    return keywords


# ─── Job Scoring ─────────────────────────────────────────────────────────────

def score_job(row: pd.Series, profile: dict) -> float:
    """Score a job by relevance to the parsed resume profile."""
    score = 0.0
    title = str(row.get("title", "")).lower()
    company = str(row.get("company", "")).lower()
    description = str(row.get("description", "")).lower()
    location = str(row.get("location", "")).lower()

    # ── Company tier scoring (nice-to-have, not dominant) ──
    tier_score = 0
    for c in TIER_BIG_TECH:
        if c.lower() in company:
            tier_score = 15
            break
    if not tier_score:
        for c in TIER_AU_NOTABLE:
            if c.lower() in company:
                tier_score = 12
                break
    if not tier_score:
        for c in TIER_TOP_TECH:
            if c.lower() in company:
                tier_score = 10
                break
    score += tier_score

    # ── Location scoring ──
    if "adelaide" in location:
        score += 15
    elif "sydney" in location:
        score += 12
    elif "melbourne" in location:
        score += 10
    if "remote" in location:
        score += 5

    # ── Title scoring ──
    title_boosts = {
        "full stack": 15, "fullstack": 15, "full-stack": 15,
        "frontend": 12, "front-end": 12, "front end": 12,
        "software engineer": 10, "web developer": 8,
        "ai engineer": 8, "ml engineer": 8, "machine learning": 8,
    }
    for term, boost in title_boosts.items():
        if term in title:
            score += boost

    # ── Skill match scoring (from resume) ──
    skill_matches = 0
    for skill in profile.get("skills", []):
        skill_lower = skill.lower()
        if skill_lower in description or skill_lower in title:
            skill_matches += 1
    score += min(skill_matches * 3, 30)  # Cap at 30

    # ── Keyword match scoring ──
    keyword_matches = 0
    for kw in profile.get("keywords", []):
        if kw in description:
            keyword_matches += 1
    score += min(keyword_matches * 2, 20)  # Cap at 20

    # ── Seniority scoring (you're mid-level, penalize too senior and internships) ──
    seniority = str(row.get("seniority", "")) or detect_seniority(str(row.get("title", "")))
    seniority_scores = {
        "executive": -40, "director": -35, "staff": -25,
        "senior": -15, "lead": -10,
        "intern": -20,  # no longer relevant
        "junior": 0,    # neutral — some grad roles are fine
    }
    score += seniority_scores.get(seniority, 0)

    # ── Penalize pure ML research / data science (you want AI-adjacent, not pure ML) ──
    if any(kw in title for kw in ["data scientist", "research scientist", "ml researcher", "machine learning researcher"]):
        score -= 15

    return score


def classify_company(company) -> str:
    """Classify company into tier."""
    if not isinstance(company, str) or not company:
        return ""
    company_lower = company.lower()
    for c in TIER_BIG_TECH:
        if c.lower() in company_lower:
            return "Big Tech"
    for c in TIER_AU_NOTABLE:
        if c.lower() in company_lower:
            return "AU Notable"
    for c in TIER_TOP_TECH:
        if c.lower() in company_lower:
            return "Top Tech"
    return ""


# ─── Seniority Detection ─────────────────────────────────────────────────────

# Patterns ordered from most to least senior.  First match wins.
_SENIORITY_PATTERNS = [
    (r"\b(?:chief|cto|cio|vp|vice.?president)\b", "executive"),
    (r"\bdirector\b", "director"),
    (r"\b(?:staff|principal|distinguished)\b", "staff"),
    (r"\bmid[- ]?(?:to[- ])?senior\b", "senior"),  # "Mid to Senior" before generic "senior"
    (r"\b(?:senior|sr\.?|snr)\b", "senior"),
    (r"\barchitect\b", "senior"),
    (r"\bmanager\b", "lead"),
    (r"\b(?:lead|team.?lead|tech.?lead)\b", "lead"),
    (r"\bmid[- ]?level\b", "mid"),
    (r"\b(?:intern(?:ship)?)\b", "intern"),
    (r"\b(?:junior|jr\.?|entry[- ]?level|new.?grad|graduate|grad\b|cadet|trainee|apprentice)\b", "junior"),
]


def detect_seniority(title: str) -> str:
    """Classify job title into seniority level. Returns '' if unclear (treat as mid)."""
    t = title.lower()
    for pattern, level in _SENIORITY_PATTERNS:
        if re.search(pattern, t):
            return level
    return ""


# ─── Smart Dedup ─────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Lowercase, strip accents, collapse whitespace/punctuation for fuzzy matching."""
    text = text.split("|")[0]  # strip suffixes like "| International Students"
    text = unicodedata.normalize("NFKD", text.lower())
    text = text.encode("ascii", "ignore").decode()  # strip accents
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def deduplicate(df: pd.DataFrame) -> pd.DataFrame:
    """Remove duplicates: first by exact URL, then by normalized (title, company) pair."""
    before = len(df)

    # Pass 1: exact URL dedup
    if "job_url" in df.columns:
        df = df.drop_duplicates(subset=["job_url"], keep="first")

    # Pass 2: fuzzy title+company dedup (catches same job across sites)
    if "title" in df.columns and "company" in df.columns:
        norm_key = (
            df["title"].fillna("").apply(_normalize)
            + "|"
            + df["company"].fillna("").apply(_normalize)
        )
        df = df.loc[~norm_key.duplicated(keep="first")]

    dupes = before - len(df)
    if dupes:
        print(f"\n  Removed {dupes} duplicates (URL + title/company matching)")

    return df.reset_index(drop=True)


# ─── Scraping ────────────────────────────────────────────────────────────────

def run_search(search_term: str, location: str, defaults: dict) -> pd.DataFrame | None:
    """Run one scrape and return the results."""
    print(f"    {search_term} → {location}")

    kwargs = {
        "site_name": defaults.get("sites", SITES),
        "search_term": search_term,
        "location": location,
        "results_wanted": defaults.get("results_wanted", 30),
        "hours_old": defaults.get("hours_old", 72),
        "description_format": "markdown",
        "country_indeed": "Australia",
        "linkedin_fetch_description": True,
        "verbose": 0,
    }

    google_term = f"{search_term} jobs in {location.split(',')[0]} since yesterday"
    kwargs["google_search_term"] = google_term

    if defaults.get("job_type"):
        kwargs["job_type"] = defaults["job_type"]

    try:
        jobs = scrape_jobs(**kwargs)
    except Exception as e:
        print(f"      Error: {e}")
        return None

    if jobs.empty:
        return None

    print(f"      → {len(jobs)} results")
    return jobs


def scrape_all(locations: list[str], search_terms: list[str], defaults: dict) -> pd.DataFrame:
    """Run all location x search_term combinations across all sources, plus remote."""
    all_dfs = []
    total = len(locations) * len(search_terms)
    i = 0

    for loc in locations:
        city = loc.split(",")[0]
        print(f"\n  [{city}]")

        # GradConnection once per city (ignores search terms)
        print(f"  GradConnection...", end="", flush=True)
        gc_jobs = scrape_gradconnection("", city)
        print(f" {len(gc_jobs)}")
        if gc_jobs:
            all_dfs.append(pd.DataFrame(gc_jobs))

        for term in search_terms:
            i += 1

            # JobSpy (Indeed, LinkedIn)
            print(f"  ({i}/{total}) JobSpy:", end=" ")
            result = run_search(term, loc, defaults)
            if result is not None:
                all_dfs.append(result)

            # AU sites (Seek, Prosple)
            print(f"           AU:", end=" ")
            au_jobs = scrape_au_sites(term, city)
            if au_jobs:
                au_df = pd.DataFrame(au_jobs)
                all_dfs.append(au_df)

    # Remote-only pass: JobSpy with is_remote (Seek doesn't support remote URL)
    print(f"\n  [Remote]")
    for j, term in enumerate(search_terms, 1):
        print(f"  ({j}/{len(search_terms)}) Remote JobSpy: {term}...", end=" ", flush=True)
        remote_kwargs = {
            "site_name": defaults.get("sites", SITES),
            "search_term": term,
            "location": "Australia",
            "results_wanted": defaults.get("results_wanted", 30),
            "hours_old": defaults.get("hours_old", 72),
            "description_format": "markdown",
            "country_indeed": "Australia",
            "linkedin_fetch_description": True,
            "is_remote": True,
            "verbose": 0,
        }
        try:
            remote_jobs = scrape_jobs(**remote_kwargs)
            if not remote_jobs.empty:
                remote_jobs["is_remote"] = True
                all_dfs.append(remote_jobs)
                print(f"{len(remote_jobs)} results")
            else:
                print("0 results")
        except Exception as e:
            print(f"Error: {e}")

    if not all_dfs:
        return pd.DataFrame()

    combined = pd.concat(all_dfs, ignore_index=True)
    combined = deduplicate(combined)

    return combined


# ─── Output ──────────────────────────────────────────────────────────────────

def save_results(df: pd.DataFrame, name: str, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    csv_path = output_dir / f"{name}_{ts}.csv"
    df.to_csv(csv_path, quoting=csv.QUOTE_NONNUMERIC, escapechar="\\", index=False)

    xlsx_path = output_dir / f"{name}_{ts}.xlsx"
    df.to_excel(xlsx_path, index=False)

    return csv_path, xlsx_path


def print_results(df: pd.DataFrame, label: str, limit: int = 0):
    cols = ["score", "seniority", "tier", "title", "company", "location", "date_posted", "site"]
    available = [c for c in cols if c in df.columns]
    display = df if limit == 0 else df.head(limit)

    print(f"\n{'='*70}")
    print(f"  {label}: {len(df)} jobs")
    print(f"{'='*70}")
    print(display[available].to_string(index=False, max_colwidth=35))


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Job Hunter - Australian jobs matched to your resume")
    parser.add_argument("--resume-dir", type=str, default="resumes", help="Path to resume .tex files")
    parser.add_argument("--search", type=str, help="Override search terms with a single custom term")
    parser.add_argument("--location", type=str, help="Single location override (e.g. 'Sydney')")
    parser.add_argument("--sites", type=str, nargs="+", default=SITES)
    parser.add_argument("--results", type=int, default=30, help="Results per search per site")
    parser.add_argument("--hours", type=int, default=72, help="Max hours since posted")
    parser.add_argument("--big-tech", action="store_true", help="Show only big tech / notable companies")
    parser.add_argument("--job-type", type=str, choices=["fulltime", "parttime", "internship", "contract"])
    parser.add_argument("--seniority", type=str, nargs="+",
                        choices=["intern", "junior", "mid", "senior", "lead", "staff", "director", "executive"],
                        help="Filter to specific seniority levels (e.g. --seniority junior mid)")
    parser.add_argument("--no-senior", action="store_true",
                        help="Exclude senior+ roles (senior, lead, staff, director, executive)")
    parser.add_argument("--top", type=int, default=30, help="Number of top results to display")
    parser.add_argument("--output", type=str, default="jobs")

    args = parser.parse_args()

    # 1. Parse resume
    print("\n[1/3] Parsing resume...")
    profile = parse_latex_resume(args.resume_dir)

    # 2. Determine search parameters
    if args.location:
        # Map short names to full
        loc_map = {
            "adelaide": "Adelaide, Australia", "sydney": "Sydney, Australia",
            "melbourne": "Melbourne, Australia",
        }
        locations = [loc_map.get(args.location.lower(), args.location)]
    else:
        locations = LOCATIONS

    search_terms = [args.search] if args.search else ROLE_SEARCHES

    defaults = {
        "sites": args.sites,
        "results_wanted": args.results,
        "hours_old": args.hours,
        "job_type": args.job_type,
    }

    # 3. Scrape
    print(f"\n[2/3] Scraping {len(locations)} locations x {len(search_terms)} roles = {len(locations)*len(search_terms)} searches...")
    jobs = scrape_all(locations, search_terms, defaults)

    if jobs.empty:
        print("\nNo jobs found.")
        return

    # 3b. Filter to AU target cities only
    if "location" in jobs.columns:
        target_cities = {"adelaide", "sydney", "melbourne", "remote"}
        loc_lower = jobs["location"].fillna("").str.lower()
        au_mask = loc_lower.apply(lambda l: any(c in l for c in target_cities))
        before = len(jobs)
        jobs = jobs[au_mask].reset_index(drop=True)
        filtered = before - len(jobs)
        if filtered:
            print(f"  Filtered out {filtered} non-target-city jobs (keeping Adelaide/Sydney/Melbourne/Remote)")

    # 4. Score and rank
    print(f"\n[3/3] Scoring {len(jobs)} jobs against your resume...")
    jobs["tier"] = jobs["company"].apply(classify_company) if "company" in jobs.columns else ""
    jobs["seniority"] = jobs["title"].apply(detect_seniority) if "title" in jobs.columns else ""
    jobs["seniority"] = jobs["seniority"].replace("", "mid")
    jobs["score"] = jobs.apply(lambda row: score_job(row, profile), axis=1)

    # Seniority filtering
    if args.no_senior:
        exclude_levels = {"senior", "lead", "staff", "director", "executive", "intern"}
        before = len(jobs)
        jobs = jobs[~jobs["seniority"].isin(exclude_levels)]
        filtered = before - len(jobs)
        if filtered:
            print(f"  Filtered out {filtered} senior+ and intern roles")

    if args.seniority:
        before = len(jobs)
        jobs = jobs[jobs["seniority"].isin(set(args.seniority))]
        filtered = before - len(jobs)
        if filtered:
            print(f"  Filtered to {len(jobs)} jobs matching seniority: {', '.join(args.seniority)}")

    jobs = jobs.sort_values("score", ascending=False).reset_index(drop=True)

    # 5. Save
    output_dir = Path(args.output)
    csv_path, xlsx_path = save_results(jobs, "ranked-jobs", output_dir)

    # 6. Display
    if args.big_tech:
        notable = jobs[jobs["tier"] != ""]
        if not notable.empty:
            print_results(notable, "BIG TECH / NOTABLE COMPANIES", args.top)
            bt_csv, bt_xlsx = save_results(notable, "notable-companies", output_dir)
            print(f"\n  Saved {len(notable)} notable company jobs → {bt_csv}")
        else:
            print("\nNo notable company jobs found.")
    else:
        print_results(jobs, f"TOP {args.top} JOBS (ranked by resume match)", args.top)

        # Also show notable companies
        notable = jobs[jobs["tier"] != ""]
        if not notable.empty:
            print_results(notable, "BIG TECH / NOTABLE COMPANIES")

    # Stats
    print(f"\n{'='*70}")
    print(f"  STATS")
    print(f"{'='*70}")
    print(f"  Total unique jobs: {len(jobs)}")

    if "site" in jobs.columns:
        site_counts = jobs["site"].value_counts()
        print(f"  By site: {dict(site_counts)}")

    if "seniority" in jobs.columns:
        sen_counts = jobs["seniority"].value_counts()
        print(f"  Seniority: {dict(sen_counts)}")

    if "tier" in jobs.columns:
        tier_counts = jobs[jobs["tier"] != ""]["tier"].value_counts()
        if not tier_counts.empty:
            print(f"  Notable: {dict(tier_counts)}")

    if "company" in jobs.columns:
        top_companies = jobs["company"].value_counts().head(10)
        print(f"  Top hiring: {dict(top_companies)}")

    print(f"\n  Saved all {len(jobs)} jobs to:")
    print(f"    {csv_path}")
    print(f"    {xlsx_path}")


if __name__ == "__main__":
    main()
