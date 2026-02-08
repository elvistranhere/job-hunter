"""
Australian job board scrapers: Seek, Prosple, GradConnection.

Seek: Extracts job data from embedded SEEK_REDUX_DATA JSON (server-side rendered).
Prosple: Uses their internal GraphQL gateway API to search graduate opportunities.
GradConnection: Scrapes article cards from search result pages.

Indeed and LinkedIn are handled by JobSpy in scrape.py — not duplicated here.

Returns list[dict] with keys: title, company, location, job_url, site, description, date_posted.
"""

import asyncio
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    "brisbane": "in-All-Brisbane-QLD",
    "perth": "in-All-Perth-WA",
    "canberra": "in-All-Canberra-ACT",
    "gold coast": "in-All-Gold-Coast-QLD",
    "hobart": "in-All-Hobart-TAS",
}

GRADCONNECTION_LOCATIONS = {
    "adelaide": "south-australia",
    "sydney": "new-south-wales",
    "melbourne": "victoria",
    "brisbane": "queensland",
    "perth": "western-australia",
    "canberra": "australian-capital-territory",
    "gold coast": "queensland",
    "hobart": "tasmania",
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


def _parse_seek_jobs(html: str) -> list[dict]:
    """Parse SEEK_REDUX_DATA from page HTML into job dicts."""
    data = _extract_seek_redux_data(html)
    if not data:
        return []

    jobs_data = data.get("results", {}).get("results", {}).get("jobs", []) or []
    results = []

    for job in jobs_data:
        job_id = str(job.get("id", ""))
        title = job.get("title", "")
        if not job_id or not title:
            continue

        company = (
            job.get("companyName", "")
            or job.get("advertiser", {}).get("description", "")
        )
        locations = job.get("locations", [])
        location = locations[0].get("label", "") if locations else ""

        listing_date = job.get("listingDate", "")
        date_display = job.get("listingDateDisplay", "")
        date_posted = date_display or (listing_date[:10] if listing_date else "")

        teaser = job.get("teaser", "")

        salary = ""
        salary_data = job.get("salary") or job.get("salaryLabel") or ""
        if isinstance(salary_data, dict):
            salary = salary_data.get("label", "")
        elif isinstance(salary_data, str):
            salary = salary_data

        work_type = job.get("workType", "")

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
            "_id": job_id,
        })

    return results


# Global Seek browser session — reused across calls to avoid re-solving Cloudflare per call
_seek_browser = None


async def _get_seek_page_async(url: str) -> str:
    """Fetch a Seek page using nodriver (undetected Chrome) to bypass Cloudflare."""
    try:
        import nodriver as uc
    except ImportError:
        print("      Seek: nodriver not installed, skipping")
        return ""

    global _seek_browser

    if _seek_browser is None:
        try:
            # Use CHROME_BINARY env var if set (e.g. Docker with Chromium)
            browser_path = os.environ.get("CHROME_BINARY")
            kwargs = {"headless": False}
            if browser_path:
                kwargs["browser_executable_path"] = browser_path
            _seek_browser = await uc.start(**kwargs)
        except Exception as e:
            print(f"      Seek: Chrome not available ({e}), skipping")
            return ""

    page = await _seek_browser.get(url)

    # Poll until Cloudflare challenge passes (usually 3-5s)
    for _ in range(15):
        await asyncio.sleep(1)
        content = await page.get_content()
        if "SEEK_REDUX_DATA" in content:
            return content

    return ""


def _get_seek_page(url: str) -> str:
    """Sync wrapper for async nodriver Seek page fetch."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already in async context (worker) — use nest_asyncio or thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(lambda: asyncio.run(_get_seek_page_async(url))).result(timeout=30)
        return loop.run_until_complete(_get_seek_page_async(url))
    except RuntimeError:
        return asyncio.run(_get_seek_page_async(url))


def scrape_seek(search_term: str, city: str, max_pages: int = 5) -> list[dict]:
    """Scrape job listings from seek.com.au using nodriver to bypass Cloudflare."""
    city_key = city.lower().split(",")[0].strip()
    location_slug = SEEK_LOCATIONS.get(city_key, "")

    results = []
    seen_ids = set()

    for page_num in range(1, max_pages + 1):
        url = f"https://www.seek.com.au/{quote_plus(search_term)}-jobs/{location_slug}?page={page_num}"

        try:
            html = _get_seek_page(url)
        except Exception as e:
            print(f"      Seek error: {e}")
            break

        if not html:
            if page_num == 1:
                print(f"      Seek page {page_num}: Cloudflare blocked")
            break

        page_jobs = _parse_seek_jobs(html)
        if not page_jobs:
            break

        for job in page_jobs:
            job_id = job.pop("_id", "")
            if job_id not in seen_ids:
                seen_ids.add(job_id)
                results.append(job)

        time.sleep(1.5)

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
      workingRights { label }
    }
  }
}
"""

# Prosple opportunity types that are not real job listings
_PROSPLE_JUNK_TYPES = {"Virtual Experience", "Competition", "Event"}


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

                # Filter non-AU working rights
                rights = [r.get("label", "") for r in (opp.get("workingRights") or [])]
                if rights and not any(r in ("Australia", "New Zealand") for r in rights):
                    continue

                # Filter junk opportunity types (virtual experiences, competitions, events)
                opp_types = [t.get("label", "") for t in (opp.get("opportunityTypes") or [])]
                type_label = opp_types[0] if opp_types else ""
                if type_label in _PROSPLE_JUNK_TYPES:
                    continue

                seen.add(dedup_key)

                location = opp.get("locationDescription") or city_key.title() or "Australia"
                close_desc = opp.get("applicationsCloseDateDescription") or ""
                apply_url = opp.get("applyByUrl") or ""
                overview = (opp.get("overview") or {}).get("summary", "") or ""

                if apply_url:
                    job_url = apply_url
                elif company:
                    job_url = f"https://au.prosple.com/graduate-employers/{_slugify(company)}"
                else:
                    job_url = "https://au.prosple.com/graduate-jobs"

                # Build richer description from available fields
                desc_parts = []
                if type_label:
                    desc_parts.append(f"[{type_label}]")
                if overview:
                    desc_parts.append(overview)
                if rights:
                    desc_parts.append(f"Work rights: {', '.join(rights)}.")
                description = " ".join(desc_parts)

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


def scrape_gradconnection(search_term: str, city: str, max_pages: int = 10) -> list[dict]:
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
    """Scrape Seek + LinkedIn for a search term + city.

    Prosple returns national results regardless of city, so it should be
    called once per search term via scrape_prosple() directly — not here.
    GradConnection ignores search terms so should be called once per city
    via scrape_gradconnection() directly. Indeed handled by JobSpy.
    """
    all_results = []

    print(f"      Seek...", end="", flush=True)
    seek = scrape_seek(search_term, city)
    print(f" {len(seek)}", end="", flush=True)
    all_results.extend(seek)

    print(f"  LinkedIn...", end="", flush=True)
    linkedin = scrape_linkedin(search_term, city)
    print(f" {len(linkedin)}")
    all_results.extend(linkedin)

    return all_results


# ─── LinkedIn (guest API, no login needed) ──────────────────────────────────

LINKEDIN_LOCATIONS = {
    "adelaide": "Adelaide%2C+South+Australia%2C+Australia",
    "sydney": "Sydney%2C+New+South+Wales%2C+Australia",
    "melbourne": "Melbourne%2C+Victoria%2C+Australia",
    "brisbane": "Brisbane%2C+Queensland%2C+Australia",
    "perth": "Perth%2C+Western+Australia%2C+Australia",
    "canberra": "Canberra%2C+Australian+Capital+Territory%2C+Australia",
    "gold coast": "Gold+Coast%2C+Queensland%2C+Australia",
    "hobart": "Hobart%2C+Tasmania%2C+Australia",
}


def _fetch_linkedin_description(job_url: str) -> str:
    """Fetch full job description from a LinkedIn job detail page."""
    for attempt in range(2):
        try:
            resp = requests.get(job_url, headers=HEADERS, timeout=10)
            if resp.status_code == 429:
                time.sleep(2)
                continue
            if resp.status_code != 200:
                return ""
            soup = BeautifulSoup(resp.text, "html.parser")
            desc_div = soup.find("div", class_="show-more-less-html__markup")
            if desc_div:
                return desc_div.get_text(separator=" ", strip=True)[:3000]
            return ""
        except Exception:
            if attempt == 0:
                time.sleep(1)
    return ""


def scrape_linkedin(search_term: str, city: str, max_results: int = 100) -> list[dict]:
    """Scrape LinkedIn jobs via the public guest API (no login required)."""
    city_key = city.lower().split(",")[0].strip()
    location = LINKEDIN_LOCATIONS.get(city_key, "Australia")

    results = []
    seen_ids = set()

    for start in range(0, max_results, 25):
        url = (
            f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
            f"?keywords={quote_plus(search_term)}&location={location}&start={start}"
        )

        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200:
                break
        except Exception as e:
            print(f"      LinkedIn error: {e}")
            break

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.find_all("div", class_="base-search-card")
        if not cards:
            break

        for card in cards:
            job = _parse_linkedin_card(card)
            if job and job["job_id"] not in seen_ids:
                seen_ids.add(job.pop("job_id"))
                results.append(job)

        if len(cards) < 25:
            break
        time.sleep(1.5)

    # Fetch descriptions concurrently (3 threads — more gets rate-limited by LinkedIn)
    jobs_with_urls = [(i, job) for i, job in enumerate(results) if job.get("job_url")]
    if jobs_with_urls:
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {
                pool.submit(_fetch_linkedin_description, job["job_url"]): i
                for i, job in jobs_with_urls
            }
            for future in as_completed(futures):
                idx = futures[future]
                results[idx]["description"] = future.result()

    return results


def _parse_linkedin_card(card) -> dict | None:
    """Parse a LinkedIn guest API job card."""
    try:
        # Job ID from data-entity-urn
        urn = card.get("data-entity-urn", "")
        job_id = urn.split(":")[-1] if urn else ""

        # Title
        title_el = card.find("h3", class_="base-search-card__title")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            return None

        # Company
        company_el = card.find("h4", class_="base-search-card__subtitle")
        company = ""
        if company_el:
            a_tag = company_el.find("a")
            company = a_tag.get_text(strip=True) if a_tag else company_el.get_text(strip=True)

        # Location
        loc_el = card.find("span", class_="job-search-card__location")
        location = loc_el.get_text(strip=True) if loc_el else ""

        # Date
        time_el = card.find("time")
        date_posted = time_el.get("datetime", "") if time_el else ""

        # URL
        link_el = card.find("a", class_="base-card__full-link")
        job_url = ""
        if link_el:
            job_url = link_el.get("href", "").split("?")[0]  # strip tracking params

        return {
            "title": title,
            "company": company,
            "location": location,
            "job_url": job_url,
            "date_posted": date_posted,
            "description": "",  # guest API doesn't include descriptions
            "site": "linkedin",
            "job_id": job_id,
        }
    except Exception:
        return None
