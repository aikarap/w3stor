#!/usr/bin/env bash
# Deploy w3stor backend to Hetzner VPS
# Usage: ./deploy.sh [user@host]
set -euo pipefail

HOST="${1:?Usage: ./deploy.sh user@host}"
REMOTE_DIR="/opt/w3stor"

echo "==> Syncing project to $HOST:$REMOTE_DIR"
rsync -avz --delete \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.next \
  --exclude=.turbo \
  --exclude=apps/web \
  --exclude=.env \
  --exclude=.env.prod \
  ./ "$HOST:$REMOTE_DIR/"

echo "==> Running deploy on remote"
ssh "$HOST" bash -s <<'REMOTE'
  set -euo pipefail
  cd /opt/w3stor

  # Load env vars for docker-compose interpolation
  set -a && source .env.prod && set +a

  echo "--- Building images (no cache for app services) ---"
  docker compose -f docker-compose.prod.yml build --no-cache api workers

  echo "--- Running migrations ---"
  docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate

  echo "--- Starting services ---"
  docker compose -f docker-compose.prod.yml up -d --force-recreate --remove-orphans

  echo "--- Waiting for API to start ---"
  sleep 3

  echo "--- Status ---"
  docker compose -f docker-compose.prod.yml ps
  docker compose -f docker-compose.prod.yml logs --tail=3 api

  echo "==> Deploy complete!"
REMOTE
