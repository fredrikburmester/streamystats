#!/usr/bin/env bash
# One-command local test stack: Postgres + ephemeral Jellyfin in Docker, and
# the two app processes (job-server, Next.js) in a tmux session, all wired
# together with generated secrets and configurable ports.
#
#   docker/dev/stack.sh up        start containers, generate media, bootstrap Jellyfin, migrate DB
#   docker/dev/stack.sh app       start job-server + Next.js in tmux (session: streamystats-dev)
#                                 WEB_RUNTIME=node runs Next.js under Node; BUN_BIN=/path/bun swaps Bun
#   docker/dev/stack.sh play ...  simulate playback (args passed to simulate-playback.sh)
#   docker/dev/stack.sh logs [n]  tail app logs from tmux
#   docker/dev/stack.sh status    show what is running
#   docker/dev/stack.sh env       print the env vars the apps run with
#   docker/dev/stack.sh app-stop  stop the tmux session
#   docker/dev/stack.sh down      stop containers (data kept)
#   docker/dev/stack.sh reset     stop containers and wipe volumes + Jellyfin state (media kept)
#
# Ports and the Jellyfin image tag live in docker/dev/.stack.env (created on
# first run, gitignored). Override there when 5432/8096/3000/3005 clash.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_DIR="$REPO/docker/dev"
STACK_ENV="$DEV_DIR/.stack.env"
TMUX_SESSION="${TMUX_SESSION:-streamystats-dev}"

log() { printf '[stack] %s\n' "$*" >&2; }

ensure_env() {
  if [ ! -f "$STACK_ENV" ]; then
    log "creating $STACK_ENV"
    cat >"$STACK_ENV" <<ENV
# Local dev stack settings (gitignored). Change ports here if they clash.
DEV_POSTGRES_PORT=5432
DEV_JELLYFIN_PORT=8096
DEV_NEXT_PORT=3000
DEV_JOB_PORT=3005
JELLYFIN_IMAGE_TAG=12.0
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=streamystats
SESSION_SECRET=$(openssl rand -base64 32)
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)
ENV
  fi
  set -a
  # shellcheck disable=SC1090
  . "$STACK_ENV"
  set +a
  export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$DEV_POSTGRES_PORT/$POSTGRES_DB"
  export JOB_SERVER_URL="http://localhost:$DEV_JOB_PORT"
  export JELLYFIN_URL="http://localhost:$DEV_JELLYFIN_PORT"
  export NEXT_URL="http://localhost:$DEV_NEXT_PORT"
}

compose() {
  docker compose -f "$REPO/docker-compose.dev.yml" --profile jellyfin "$@"
}

app_env() {
  printf 'DATABASE_URL=%s JOB_SERVER_URL=%s SESSION_SECRET=%s NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=%s' \
    "$DATABASE_URL" "$JOB_SERVER_URL" "$SESSION_SECRET" "$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"
}

cmd_up() {
  ensure_env
  "$DEV_DIR/jellyfin/generate-media.sh"
  log "starting containers (postgres :$DEV_POSTGRES_PORT, jellyfin :$DEV_JELLYFIN_PORT, tag $JELLYFIN_IMAGE_TAG)"
  compose up -d --wait
  "$DEV_DIR/jellyfin/bootstrap.sh"
  log "building database package and running migrations"
  (cd "$REPO/packages/database" && bun run build >/dev/null && bun run db:migrate)
  log "up. Next: docker/dev/stack.sh app"
}

cmd_app() {
  ensure_env
  if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    log "tmux session $TMUX_SESSION already running (use app-stop first)"
    return 0
  fi
  # WEB_RUNTIME=node runs Next.js under Node instead of Bun (mirrors the production
  # image); BUN_BIN=/path/to/bun swaps in another Bun build for both processes.
  local web_script="dev" path_prefix=""
  [ "${WEB_RUNTIME:-bun}" = "node" ] && web_script="dev:node"
  [ -n "${BUN_BIN:-}" ] && path_prefix="PATH=$(dirname "$BUN_BIN"):\$PATH "
  tmux new-session -d -s "$TMUX_SESSION" -n job -c "$REPO/apps/job-server"
  tmux send-keys -t "$TMUX_SESSION:job" "env ${path_prefix}$(app_env) PORT=$DEV_JOB_PORT bun run --watch src/index.ts" Enter
  tmux new-window -t "$TMUX_SESSION" -n web -c "$REPO/apps/nextjs-app"
  tmux send-keys -t "$TMUX_SESSION:web" "env ${path_prefix}$(app_env) PORT=$DEV_NEXT_PORT bun run $web_script" Enter
  log "started. web: $NEXT_URL  job-server: $JOB_SERVER_URL  (tmux attach -t $TMUX_SESSION)"
}

cmd_app_stop() {
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null && log "stopped $TMUX_SESSION" || log "no tmux session"
}

cmd_logs() {
  local n=${1:-60}
  for w in job web; do
    printf '===== %s (last %s lines) =====\n' "$w" "$n"
    tmux capture-pane -t "$TMUX_SESSION:$w" -p -S "-$n" 2>/dev/null || echo "(not running)"
  done
}

cmd_status() {
  ensure_env
  compose ps
  echo
  tmux has-session -t "$TMUX_SESSION" 2>/dev/null && echo "tmux: $TMUX_SESSION running" || echo "tmux: not running"
  echo "web: $NEXT_URL  job-server: $JOB_SERVER_URL  jellyfin: $JELLYFIN_URL  db: $DATABASE_URL"
}

cmd_env() {
  ensure_env
  echo "export $(app_env) JELLYFIN_URL=$JELLYFIN_URL"
}

cmd_play() {
  ensure_env
  "$DEV_DIR/jellyfin/simulate-playback.sh" "$@"
}

cmd_down() {
  ensure_env
  cmd_app_stop
  compose down
}

cmd_reset() {
  ensure_env
  cmd_app_stop
  compose down -v
  rm -f "$DEV_DIR/jellyfin/.state.env"
  log "volumes and Jellyfin state removed (media kept in docker/dev/jellyfin/media)"
}

case "${1:-}" in
  up) cmd_up ;;
  app) cmd_app ;;
  app-stop) cmd_app_stop ;;
  logs) shift; cmd_logs "$@" ;;
  status) cmd_status ;;
  env) cmd_env ;;
  play) shift; cmd_play "$@" ;;
  down) cmd_down ;;
  reset) cmd_reset ;;
  *) sed -n '2,20p' "$0"; exit 2 ;;
esac
