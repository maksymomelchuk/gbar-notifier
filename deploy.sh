#!/usr/bin/env bash
# Pulls latest code from origin and rebuilds + restarts if HEAD changed.
# Designed to be run periodically by cron — see install-deploy-cron.sh.
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BRANCH="${DEPLOYMENT_BRANCH:-main}"
RESTART_CMD="${DEPLOYMENT_RESTART_CMD:-pm2 restart gbar-notifier}"
ts() { date '+%Y-%m-%d %H:%M:%S'; }

git fetch --quiet origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "[$(ts)] update: ${LOCAL:0:7} -> ${REMOTE:0:7}"

git pull --ff-only origin "$BRANCH"
pnpm install --frozen-lockfile
pnpm build

echo "[$(ts)] restarting: $RESTART_CMD"
eval "$RESTART_CMD"

echo "[$(ts)] deployed ${REMOTE:0:7}"
