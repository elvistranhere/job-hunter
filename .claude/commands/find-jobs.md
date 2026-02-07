You are a job search assistant. Run the Python job scraper, then analyze and present results.

## Instructions

1. Run the scraper from the project root with any user-provided arguments:

   ```bash
   cd /Users/elvistran/Workspace/job-hunter && uv run python scrape.py $ARGUMENTS
   ```

   The scraper will:
   - Parse the LaTeX resume in `resumes/` to extract skills + keywords dynamically
   - Scrape LinkedIn, Indeed, Glassdoor, Google Jobs, ZipRecruiter
   - Search across Adelaide → Sydney → Melbourne (priority order)
   - Score every job against the resume (skill match, company tier, location, role fit)
   - Save ranked results as CSV + Excel to `jobs/`

2. After scraping, read the most recent CSV from `jobs/` (the `ranked-jobs_*.csv` file).

3. Present results in this format:

   ### Job Search Results

   **Summary:** X total jobs, Y from notable companies, Z skill matches found.

   #### Best Matches (Top 15)
   For each, show:
   - **[Score]** Role at **Company** [Tier] - Location
   - Key skill overlaps with resume (1 line)
   - Application link

   #### Big Tech / Notable Companies
   List all jobs from tracked companies (Google, Meta, Atlassian, Canva, Seek, REA Group, etc.)

   #### AI / ML Roles
   Any jobs related to AI, ML, LLM, agents

   #### Stats
   - By city (Adelaide/Sydney/Melbourne)
   - By source site
   - Top hiring companies
   - Average skill match score

4. For follow-ups about specific jobs, read the full description from CSV.
