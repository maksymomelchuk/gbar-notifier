#!/usr/bin/env bash
# Installs (or replaces) a crontab entry that runs deploy.sh every
# DEPLOYMENT_POLL_INTERVAL minutes. Run once on the LXC after editing .env.
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"
PROJECT_DIR="$(pwd)"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

INTERVAL="${DEPLOYMENT_POLL_INTERVAL:-}"

if ! [[ "$INTERVAL" =~ ^[0-9]+$ ]] || [ "$INTERVAL" -lt 1 ] || [ "$INTERVAL" -gt 59 ]; then
  echo "DEPLOYMENT_POLL_INTERVAL must be an integer between 1 and 59 (minutes). Got: '${INTERVAL}'" >&2
  echo "Note: cron's */N syntax only works cleanly for values that divide 60 (1,2,3,4,5,6,10,12,15,20,30)." >&2
  exit 1
fi

MARKER="# gbar-notifier-deploy"
CRON_LINE="*/$INTERVAL * * * * cd $PROJECT_DIR && ./deploy.sh >> $PROJECT_DIR/deploy.log 2>&1 $MARKER"

NEW_CRONTAB=$( { crontab -l 2>/dev/null || true; } | grep -v "$MARKER" || true )
if [ -n "$NEW_CRONTAB" ]; then
  printf '%s\n%s\n' "$NEW_CRONTAB" "$CRON_LINE" | crontab -
else
  printf '%s\n' "$CRON_LINE" | crontab -
fi

echo "Installed cron entry (every ${INTERVAL} min):"
echo "  $CRON_LINE"
echo
echo "Logs: $PROJECT_DIR/deploy.log"
echo "Remove with: crontab -l | grep -v '$MARKER' | crontab -"
