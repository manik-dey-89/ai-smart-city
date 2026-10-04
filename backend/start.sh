#!/usr/bin/env bash
# start.sh — Render / any platform entrypoint
#
# 1. Run seed.py (idempotent — skips existing users/roles, safe on every deploy)
# 2. Start the FastAPI app with uvicorn
#
# Render start command:  bash start.sh
# Docker CMD equivalent: CMD ["bash", "start.sh"]

set -e   # exit immediately if any command fails

echo "==> Running database seed (idempotent)..."
python seed.py

echo "==> Starting uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
