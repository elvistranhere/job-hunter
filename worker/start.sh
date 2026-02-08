#!/bin/bash
# Start Xvfb (virtual display) for nodriver/Seek scraper, then launch uvicorn
Xvfb :99 -screen 0 1280x720x24 -nolisten tcp &
export DISPLAY=:99

exec uvicorn worker.main:app --host 0.0.0.0 --port 8000
