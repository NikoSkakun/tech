#!/usr/bin/env bash
# Usage: tools/dev-start.sh <agent-id> <port>
# Starts (or restarts) the Vite dev server of the worktree /srv/electricity/wt/<id> in tmux session dev-<id>,
# bound to 0.0.0.0:<port>, and waits until it answers. Stop it with: tmux kill-session -t dev-<id>
set -euo pipefail
ID="${1:?agent id required}"; PORT="${2:?port required}"
APP="/srv/electricity/wt/$ID/app"
[ -d "$APP" ] || APP="/srv/electricity/repo/app"
[ -f "$APP/package.json" ] || { echo "no app at $APP" >&2; exit 1; }
SESSION="dev-$ID"
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new -d -s "$SESSION" "cd '$APP' && pnpm dev --host 0.0.0.0 --port $PORT --strictPort 2>&1 | tee /srv/electricity/logs/dev-$ID.log"
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://localhost:$PORT/"; then echo "dev server up: http://localhost:$PORT/ (tmux session $SESSION)"; exit 0; fi
  sleep 0.5
done
echo "dev server did not start; see /srv/electricity/logs/dev-$ID.log" >&2
tail -20 "/srv/electricity/logs/dev-$ID.log" >&2 || true
exit 1
