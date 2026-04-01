#!/bin/bash
# W3Stor VPS Rebuild — tears down containers without touching data volumes
# Usage: ssh root@<vps> "cd /opt/w3stor && bash infra/rebuild.sh"
set -euo pipefail

COMPOSE_FILE="infra/docker-compose.prod.yml"
PROTECTED_VOLUMES=("w3stor_postgres_data" "infra_neo4j_data")

red()   { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
cyan()  { echo -e "\033[36m==> $*\033[0m"; }

# Must run from project root
if [ ! -f ".env.prod" ]; then
  red "error: .env.prod not found. Run from /opt/w3stor or sync env first."
  exit 1
fi

# Source env for compose interpolation
set -a && source .env.prod && set +a

# --- Step 1: Verify protected volumes exist ---
cyan "Checking protected volumes..."
for vol in "${PROTECTED_VOLUMES[@]}"; do
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    green "  $vol exists"
  else
    red "  WARNING: $vol not found — it will be created empty on next up"
  fi
done

# --- Step 2: Stop and remove containers + networks (NOT volumes) ---
cyan "Stopping and removing containers..."
docker compose -f "$COMPOSE_FILE" down
green "  Containers removed"

# --- Step 3: Verify volumes survived ---
cyan "Verifying volumes after teardown..."
for vol in "${PROTECTED_VOLUMES[@]}"; do
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    green "  $vol intact"
  else
    red "  CRITICAL: $vol is missing! Aborting before rebuild."
    exit 1
  fi
done

# --- Step 4: Clean up non-essential volumes + old images ---
cyan "Cleaning non-essential volumes..."
docker volume rm w3stor_redis_data w3stor_caddy_data w3stor_caddy_config 2>/dev/null || true

cyan "Removing old app image..."
docker image rm w3stor-app 2>/dev/null || true
docker image prune -f

# --- Step 5: Rebuild and start ---
cyan "Building image (no cache)..."
docker compose -f "$COMPOSE_FILE" build --no-cache api

cyan "Running migrations..."
docker compose -f "$COMPOSE_FILE" --profile migrate run --rm migrate

cyan "Starting all services..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans

# --- Step 6: Verify ---
sleep 3
cyan "Service status:"
docker compose -f "$COMPOSE_FILE" ps

cyan "API logs (last 5 lines):"
docker compose -f "$COMPOSE_FILE" logs --tail=5 api

green "Rebuild complete!"
