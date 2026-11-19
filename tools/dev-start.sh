#!/usr/bin/env bash
# Usage: tools/dev-start.sh <agent-id> <port>
# Starts (or restarts) the Vite dev server of the worktree $ELECTRICITY_ROOT/wt/<id> (root default /srv/electricity)
# in tmux session dev-<id>, bound to $DEV_HOST:<port> (default 0.0.0.0), and waits until it answers.
# Stop it with: tmux kill-session -t dev-<id>
# Without tmux (a workstation copy, docs/ORCHESTRATOR.md «Local workstation») the server runs detached with
# setsid in its own session, id in $ROOT/logs/dev-<id>.pid; stop it with: pkill -s $(cat $ROOT/logs/dev-<id>.pid)
set -euo pipefail
ID="${1:?agent id required}"; PORT="${2:?port required}"
ROOT="${ELECTRICITY_ROOT:-/srv/electricity}"; HOST="${DEV_HOST:-0.0.0.0}"
APP="$ROOT/wt/$ID/app"
[ -d "$APP" ] || APP="$ROOT/repo/app"
[ -f "$APP/package.json" ] || { echo "no app at $APP" >&2; exit 1; }
SESSION="dev-$ID"; LOG="$ROOT/logs/dev-$ID.log"; PID="$ROOT/logs/dev-$ID.pid"
mkdir -p "$ROOT/logs"
if command -v tmux >/dev/null; then
  tmux kill-session -t "$SESSION" 2>/dev/null || true
  tmux new -d -s "$SESSION" "cd '$APP' && pnpm dev --host $HOST --port $PORT --strictPort 2>&1 | tee '$LOG'"
  HOW="tmux session $SESSION"
else
  # its own session, whose id is written to the pid file; pkill -s stops pnpm, vite and their children together
  [ -f "$PID" ] && pkill -s "$(cat "$PID")" 2>/dev/null || true
  rm -f "$PID"
  cd "$APP"
  setsid bash -c 'echo $$ > "$0"; exec pnpm dev --host "$1" --port "$2" --strictPort' "$PID" "$HOST" "$PORT" \
    > "$LOG" 2>&1 < /dev/null &
  disown
  for _ in $(seq 1 20); do [ -s "$PID" ] && break; sleep 0.1; done
  HOW="session $(cat "$PID"), stop: pkill -s $(cat "$PID")"
fi
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://localhost:$PORT/"; then echo "dev server up: http://localhost:$PORT/ ($HOW)"; exit 0; fi
  sleep 0.5
done
echo "dev server did not start; see $LOG" >&2
tail -20 "$LOG" >&2 || true
exit 1
