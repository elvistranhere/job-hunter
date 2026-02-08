#!/bin/bash
# Script to manually trigger the daily job scrape workflow
# Usage: ./trigger_job_scrape.sh [full_run] [min_score]

set -e

FULL_RUN="${1:-false}"
MIN_SCORE="${2:-20}"

echo "🚀 Triggering Daily Job Scrape workflow..."
echo "   Full run: $FULL_RUN"
echo "   Min score: $MIN_SCORE"
echo ""

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo ""
    echo "Install it:"
    echo "  - macOS: brew install gh"
    echo "  - Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  - Windows: https://github.com/cli/cli/releases"
    echo ""
    echo "Or trigger manually at:"
    echo "  https://github.com/elvistranhere/job-hunter/actions/workflows/daily-scrape.yml"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI"
    echo ""
    echo "Run: gh auth login"
    exit 1
fi

# Trigger workflow
gh workflow run daily-scrape.yml \
    -f full_run="$FULL_RUN" \
    -f min_score="$MIN_SCORE"

echo ""
echo "✅ Workflow triggered!"
echo ""
echo "View runs:"
echo "  https://github.com/elvistranhere/job-hunter/actions/workflows/daily-scrape.yml"
echo ""
echo "Or run: gh run list --workflow=daily-scrape.yml"
