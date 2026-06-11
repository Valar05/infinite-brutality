#!/data/data/com.termux/files/usr/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
WORKSPACE_DIR=$(CDPATH= cd -- "$REPO_DIR/.." && pwd)
STATE_DIR="$REPO_DIR/.tmp/dev-server"
LOG_FILE="$STATE_DIR/http-8798.log"
SESSION_NAME="infinite-brutality-server"
PORT=8798
HOST=127.0.0.1
URL="http://$HOST:$PORT/infinite-brutality/index.html"

mkdir -p "$STATE_DIR"

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  if curl -fsS "$URL" >/dev/null 2>&1; then
    echo "server already running: $URL (tmux $SESSION_NAME)"
    exit 0
  fi
  tmux kill-session -t "$SESSION_NAME" || true
fi

: > "$LOG_FILE"
CMD="cd '$WORKSPACE_DIR' && exec python3 -m http.server '$PORT' --bind '$HOST' >> '$LOG_FILE' 2>&1"
tmux new-session -d -s "$SESSION_NAME" "$CMD"

ok=0
count=0
while [ "$count" -lt 25 ]; do
  if curl -fsS "$URL" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 0.2
  count=$((count + 1))
done

if [ "$ok" -ne 1 ]; then
  echo "server failed to start; log: $LOG_FILE" >&2
  exit 1
fi

echo "server running: $URL (tmux $SESSION_NAME)"
