#!/data/data/com.termux/files/usr/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
LOG_FILE="$REPO_DIR/.tmp/dev-server/http-8798.log"
SESSION_NAME="infinite-brutality-server"
URL="http://127.0.0.1:8798/infinite-brutality/index.html"

if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "server not running"
  exit 1
fi

if curl -fsS "$URL" >/dev/null 2>&1; then
  echo "server running: $URL (tmux $SESSION_NAME)"
else
  echo "server session exists but health check failed (tmux $SESSION_NAME, log $LOG_FILE)"
  exit 1
fi
