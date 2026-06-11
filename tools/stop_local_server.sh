#!/data/data/com.termux/files/usr/bin/sh
set -eu

SESSION_NAME="infinite-brutality-server"
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux kill-session -t "$SESSION_NAME"
  echo "server stopped (tmux $SESSION_NAME)"
else
  echo "server not running"
fi
