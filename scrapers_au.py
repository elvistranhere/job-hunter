"""
Australian job board scrapers: Seek, Prosple, GradConnection.

Seek: Extracts job data from embedded SEEK_REDUX_DATA JSON (server-side rendered).
Prosple: Uses their internal GraphQL gateway API to search graduate opportunities.
GradConnection: Scrapes article cards from search result pages.

Indeed and LinkedIn are handled by JobSpy in scrape.py — not duplicated here.

Returns list[dict] with keys: title, company, location, job_url, site, description, date_posted.
"""

import json
import re
import time
from urllib.parse import quote_plus, urljoin

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.9",
}

# ── Location mappings ────────────────────────────────────────────────────────

SEEK_LOCATIONS = {
    "adelaide": "in-All-Adelaide-SA",
    "sydney": "in-All-Sydney-NSW",
    "melbourne": "in-All-Melbourne-VIC",
}

GRADCONNECTION_LOCATIONS = {
    "adelaide": "south-australia",
    "sydney": "new-south-wales",
    "melbourne": "victoria",
}



# ─── Seek ────────────────────────────────────────────────────────────────────

def _extract_seek_redux_data(html: str) -> dict | None:
    """Extract the SEEK_REDUX_DATA JSON blob from page HTML using balanced brace matching."""
    marker = "window.SEEK_REDUX_DATA = "
    start = html.find(marker)
    if start == -1:
        return None
    start += len(marker)

    depth = 0
    end = start
    for i, c in enumerate(html[start:], start):
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    try:
        return json.loads(html[start:end])
    except (json.JSONDecodeError, ValueError):
        return None


def scrape_seek(search_term: str, city: str, max_pages: int = 5) -> list[dict]:
    """Scrape job listings from seek.com.au by parsing embedded SEEK_REDUX_DATA JSON."""
    city_key = city.lower().split(",")[0].strip()
    location_slug = SEEK_LOCATIONS.get(city_key, "")

    results = []
    seen_ids = set()

    for page in range(1, max_pages + 1):
        url = f"https://www.seek.com.au/{quote_plus(search_term)}-jobs/{location_slug}?page={page}"

        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200:
                print(f"      Seek page {page}: HTTP {resp.status_code}")
                break
        except Exception as e:
            print(f"      Seek error: {e}")
            break

        data = _extract_seek_redux_data(resp.text)
        if not data:
            break

        jobs_data = (
            data.get("results", {})
            .get("results", {})
            .get("jobs", [])
        )
        if not jobs_data:
            break

        for job in jobs_data:
            job_id = str(job.get("id", ""))
            if not job_id or job_id in seen_ids:
                continue
            seen_ids.add(job_id)

            title = job.get("title", "")
            if not title:
                continue

            company = (
                job.get("companyName", "")
                or job.get("advertiser", {}).get("description", "")
            )
            locations = job.get("locations", [])
            location = locations[0].get("label", "") if locations else ""

            listing_date = job.get("listingDate", "")
            date_display = job.get("listingDateDisplay", "")
            if date_display:
                date_posted = date_display
            elif listing_date:
                date_posted = listing_date[:10]
            else:
                date_posted = ""

            teaser = job.get("teaser", "")

            # Extract salary info
            salary = ""
            salary_data = job.get("salary") or job.get("salaryLabel") or ""
            if isinstance(salary_data, dict):
                salary = salary_data.get("label", "")
            elif isinstance(salary_data, str):
                salary = salary_data

            # Extract work type (full-time, part-time, contract, casual)
            work_type = job.get("workType", "")

            # Extract work arrangement (office, hybrid, remote)
            work_arrangements = job.get("workArrangements", {})
            if isinstance(work_arrangements, dict):
                work_arrangement = work_arrangements.get("label", "")
            elif isinstance(work_arrangements, list) and work_arrangements:
                work_arrangement = work_arrangements[0].get("label", "") if isinstance(work_arrangements[0], dict) else str(work_arrangements[0])
            else:
                work_arrangement = ""

            results.append({
                "title": title,
                "company": company,
                "location": location,
                "job_url": f"https://www.seek.com.au/job/{job_id}",
                "date_posted": date_posted,
                "description": teaser,
                "salary": salary,
                "work_type": work_type,
                "work_arrangement": work_arrangement,
                "site": "seek",
            })

        time.sleep(2.5)

    return results


# ─── Prosple ─────────────────────────────────────────────────────────────────

PROSPLE_GW_URL = "https://prosple-gw.global.ssl.fastly.net/internal"

PROSPLE_SEARCH_QUERY = """
query OpportunitiesSearch($parameters: OpportunitiesSearchInput!) {
  opportunitiesSearch(parameters: $parameters) {
    resultCount
    opportunities {
      id
      title
      expired
      overview { summary }
      opportunityTypes { label }
      locationDescription
      applicationsCloseDateDescription
      applyByUrl
      parentEmployer { advertiserName }
    }
  }
}
"""


def scrape_prosple(search_term: str, city: str, max_results: int = 100) -> list[dict]:
    """Search graduate opportunities from au.prosple.com via their gateway GraphQL API."""
    city_key = city.lower().split(",")[0].strip()

    # Don't filter by city — Prosple is a national grad jobs site,
    # most listings cover multiple cities. Dedup handles cross-city overlap.
    keywords = search_term

    session = requests.Session()
    session.headers.update({
        "User-Agent": HEADERS["User-Agent"],
        "Content-Type": "application/json",
        "Origin": "https://au.prosple.com",
        "Referer": "https://au.prosple.com/graduate-jobs",
    })

    results = []
    seen = set()
    page_size = 50

    for offset in range(0, max_results, page_size):
        try:
            resp = session.post(
                PROSPLE_GW_URL,
                json={
                    "query": PROSPLE_SEARCH_QUERY,
                    "variables": {
                        "parameters": {
                            "sortBy": {"criteria": "POPULARITY", "direction": "DESC"},
                            "keywords": keywords,
                            "range": {"limit": page_size, "offset": offset},
                        },
                    },
                },
                timeout=15,
            )
            if resp.status_code != 200:
                break

            data = resp.json()
            if "errors" in data:
                break

            opps = (
                data.get("data", {})
                .get("opportunitiesSearch", {})
                .get("opportunities", [])
            )
            if not opps:
                break

            for opp in opps:
                if opp.get("expired"):
                    continue

                title = opp.get("title", "")
                employer_data = opp.get("parentEmployer") or {}
                company = employer_data.get("advertiserName", "")
                dedup_key = (title.lower(), company.lower())
                if not title or dedup_key in seen:
                    continue
                seen.add(dedup_key)

                location = opp.get("locationDescription") or city_key.title() or "Australia"
                close_desc = opp.get("applicationsCloseDateDescription") or ""
                apply_url = opp.get("applyByUrl") or ""
                overview = (opp.get("overview") or {}).get("summary", "") or ""
                opp_types = [t.get("label", "") for t in (opp.get("opportunityTypes") or [])]
                type_label = opp_types[0] if opp_types else ""

                if apply_url:
                    job_url = apply_url
                elif company:
                    job_url = f"https://au.prosple.com/graduate-employers/{_slugify(company)}"
                else:
                    job_url = "https://au.prosple.com/graduate-jobs"

                description = overview[:200]
                if type_label:
                    description = f"[{type_label}] {description}"

                results.append({
                    "title": title,
                    "company": company,
                    "location": location,
                    "job_url": job_url,
                    "date_posted": close_desc,
                    "description": description,
                    "site": "prosple",
                })

            if len(opps) < page_size:
                break
            time.sleep(1)

        except Exception as e:
            print(f"      Prosple error: {e}")
            break

    return results


def _slugify(name: str) -> str:
    """Convert company name to URL slug."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ─── GradConnection ──────────────────────────────────────────────────────────

GRADCONNECTION_CATEGORIES = [
    "computer-science",
    "engineering",
    "information-technology",
]

# Junk patterns for GradConnection (events, webinars, competitions — not real job listings)
_GC_JUNK_PATTERNS = re.compile(
    r"(?i)\b(?:webinar|information sessions?|careers? fair|workshop|competition|"
    r"women in consulting|future thinking|pre-registration|unlock your potential|"
    r"discover ey|tap into tax|psychometric|futurefocus|"
    r"networking event|bootcamp|insight programme|virtual experience|open day)\b"
    r"|^event\s*[-–]"
)


def scrape_gradconnection(search_term: str, city: str, max_pages: int = 3) -> list[dict]:
    """Scrape graduate job listings from au.gradconnection.com.

    Note: GradConnection ignores the keywords param — returns all jobs in the
    category regardless. search_term is accepted for API compat but not used.
    Call this once per city, not once per search term.
    """
    city_key = city.lower().split(",")[0].strip()
    location_slug = GRADCONNECTION_LOCATIONS.get(city_key, "")

    results = []
    for category in GRADCONNECTION_CATEGORIES:
        for page in range(1, max_pages + 1):
            url = f"https://au.gradconnection.com/graduate-jobs/{category}/"
            if location_slug:
                url += f"{location_slug}/"
            if page > 1:
                url += f"?page={page}"

            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                if resp.status_code != 200:
                    break
            except Exception as e:
                print(f"      GradConnection error: {e}")
                break

            soup = BeautifulSoup(resp.text, "html.parser")

            # GradConnection uses <section class="box_container"> wrappers,
            # each containing a <header class="box-header"> with title + employer
            containers = soup.find_all("section", class_="box_container")
            if not containers:
                break

            for container in containers:
                job = _parse_gradconnection_card(container)
                if job:
                    results.append(job)

            time.sleep(1.5)

    # Deduplicate by URL
    seen = set()
    unique = []
    for j in results:
        if j["job_url"] not in seen:
            seen.add(j["job_url"])
            unique.append(j)

    return unique


def _parse_gradconnection_card(container) -> dict | None:
    """Parse a GradConnection section.box_container element."""
    try:
        header = container.find("header", class_="box-header")
        if not header:
            return None

        # Job title + URL from <a class="box-header-title">
        title_link = header.find("a", class_="box-header-title")
        if not title_link:
            return None

        title = title_link.get_text(strip=True)
        if not title or len(title) < 3:
            return None

        # Filter junk entries (events, webinars, competitions)
        if _GC_JUNK_PATTERNS.search(title):
            return None

        href = title_link.get("href", "")
        job_url = urljoin("https://au.gradconnection.com", href)

        # Company from <div class="box-employer-name"> > a > p.box-header-para
        company = ""
        employer_div = header.find("div", class_="box-employer-name")
        if employer_div:
            company_el = employer_div.find("p", class_="box-header-para")
            if company_el:
                company = company_el.get_text(strip=True)
        if not company:
            m = re.search(r"/employers/([^/]+)/", href)
            if m:
                company = m.group(1).replace("-", " ").title()

        # Closing date from <span class="closing-in">
        date_posted = ""
        closing_el = container.find("span", class_="closing-in")
        if closing_el:
            date_posted = closing_el.get_text(strip=True)

        # Description from <p class="box-description-para">
        description = ""
        desc_el = container.find("p", class_="box-description-para")
        if desc_el:
            description = desc_el.get_text(strip=True)[:200]

        return {
            "title": title,
            "company": company,
            "location": "Australia",
            "job_url": job_url,
            "date_posted": date_posted,
            "description": description,
            "site": "gradconnection",
        }
    except Exception:
        return None


# ─── Unified runner ──────────────────────────────────────────────────────────

def scrape_au_sites(search_term: str, city: str) -> list[dict]:
    """Scrape Seek + Prosple for a search term + city.

    GradConnection ignores search terms so should be called once per city
    via scrape_gradconnection() directly. Indeed/LinkedIn handled by JobSpy.
    """
    all_results = []

    print(f"      Seek...", end="", flush=True)
    seek = scrape_seek(search_term, city)
    print(f" {len(seek)}", end="", flush=True)
    all_results.extend(seek)

    print(f"  Prosple...", end="", flush=True)
    prosple = scrape_prosple(search_term, city)
    print(f" {len(prosple)}", end="", flush=True)
    all_results.extend(prosple)

    print()
    return all_results
