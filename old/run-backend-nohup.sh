#!/usr/bin/env bash
set -euo pipefail

# Start FastAPI backend under nohup with correct PYTHONPATH
# Works from anywhere; creates a local venv if missing and installs deps.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/dashboard/backend"
REQ_FILE="$ROOT_DIR/dashboard/requirements.txt"
LOG_FILE="$ROOT_DIR/backend.log"
PID_FILE="$ROOT_DIR/backend.pid"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found" >&2
  exit 1
fi

# Create venv if needed
if [ ! -d "$ROOT_DIR/.venv" ]; then
  python3 -m venv "$ROOT_DIR/.venv"
fi
# shellcheck disable=SC1091
source "$ROOT_DIR/.venv/bin/activate"

# Install dependencies
pip install -q -r "$REQ_FILE"

# Warn if no API key present (drafts will use fallback templates)
if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "Warning: OPENAI_API_KEY not set; AI drafts will use local fallback." >&2
fi

# Start backend with proper module resolution
mkdir -p "$(dirname "$LOG_FILE")"
cd "$BACKEND_DIR"
PYTHONPATH="$ROOT_DIR" nohup python main.py >"$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_FILE"

echo "Backend started (PID $BACKEND_PID) on http://localhost:8000"
echo "Logs: $LOG_FILE"
echo "PID file: $PID_FILE"
