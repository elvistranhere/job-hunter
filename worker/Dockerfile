FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies: gcc for native packages, Chromium + Xvfb for Seek scraper (nodriver)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc libffi-dev \
        chromium chromium-driver \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path for nodriver (Debian uses "chromium" not "google-chrome")
ENV CHROME_BINARY=/usr/bin/chromium

# Install Python dependencies
COPY worker/requirements.txt /app/worker/requirements.txt
RUN pip install --no-cache-dir -r /app/worker/requirements.txt

# Copy the worker API
COPY worker/ /app/worker/

# Copy the existing scrapers and email module (worker imports from these)
COPY scrape.py /app/scrape.py
COPY scrapers_au.py /app/scrapers_au.py
COPY email_digest.py /app/email_digest.py

# Copy resumes for the resume parser fallback (if needed)
COPY resumes/ /app/resumes/

# The worker's sys.path insert points to parent of worker/, which is /app
# so imports of scrape, scrapers_au, email_digest resolve to /app/*.py

# Copy startup script
COPY worker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8000

CMD ["/app/start.sh"]
