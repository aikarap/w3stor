#!/bin/sh
# Worker autoscaler sidecar
# Polls Redis queue depth and scales worker replicas via Docker socket
set -eu

# Configuration (all from ENV with defaults)
MIN_WORKERS="${AUTOSCALER_MIN_WORKERS:-1}"
MAX_WORKERS="${AUTOSCALER_MAX_WORKERS:-4}"
POLL_INTERVAL="${AUTOSCALER_POLL_INTERVAL:-30}"
SCALE_UP_THRESHOLD="${AUTOSCALER_SCALE_UP_THRESHOLD:-10}"
SCALE_DOWN_THRESHOLD="${AUTOSCALER_SCALE_DOWN_THRESHOLD:-3}"
COOLDOWN="${AUTOSCALER_COOLDOWN:-60}"
COMPOSE_FILE="${COMPOSE_FILE:-/compose.yml}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-w3stor}"

# Parse Redis URL: redis://host:port
REDIS_HOST=$(echo "${REDIS_URL:-redis://redis:6379}" | sed 's|redis://||' | cut -d: -f1)
REDIS_PORT=$(echo "${REDIS_URL:-redis://redis:6379}" | sed 's|redis://||' | cut -d: -f2)

last_scale_time=0

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] autoscaler: $*"
}

get_queue_depth() {
  # BullMQ stores waiting jobs in a Redis list: bull:<queue>:wait
  # and delayed jobs in a sorted set: bull:<queue>:delayed
  waiting=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LLEN "bull:filecoin-operations:wait" 2>/dev/null || echo 0)
  delayed=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZCARD "bull:filecoin-operations:delayed" 2>/dev/null || echo 0)
  echo $((waiting + delayed))
}

get_current_replicas() {
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps --format json workers 2>/dev/null | grep -c '"running"' || echo 1
}

scale_workers() {
  target=$1
  now=$(date +%s)
  elapsed=$((now - last_scale_time))

  if [ "$elapsed" -lt "$COOLDOWN" ]; then
    log "cooldown active (${elapsed}s/${COOLDOWN}s), skipping scale to $target"
    return
  fi

  log "scaling workers to $target"
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d --scale workers="$target" --no-recreate workers
  last_scale_time=$(date +%s)
}

# Install redis-cli if not present
if ! command -v redis-cli >/dev/null 2>&1; then
  apk add --no-cache redis >/dev/null 2>&1
fi

log "started (min=$MIN_WORKERS max=$MAX_WORKERS up_threshold=$SCALE_UP_THRESHOLD down_threshold=$SCALE_DOWN_THRESHOLD poll=${POLL_INTERVAL}s cooldown=${COOLDOWN}s)"

# Wait for Redis to be ready
until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PING 2>/dev/null | grep -q PONG; do
  log "waiting for Redis..."
  sleep 5
done

log "redis connected"

while true; do
  depth=$(get_queue_depth)
  current=$(get_current_replicas)

  if [ "$depth" -gt "$SCALE_UP_THRESHOLD" ] && [ "$current" -lt "$MAX_WORKERS" ]; then
    target=$((current + 1))
    if [ "$target" -gt "$MAX_WORKERS" ]; then target=$MAX_WORKERS; fi
    log "queue_depth=$depth current=$current -> scaling UP to $target"
    scale_workers "$target"

  elif [ "$depth" -lt "$SCALE_DOWN_THRESHOLD" ] && [ "$current" -gt "$MIN_WORKERS" ]; then
    target=$((current - 1))
    if [ "$target" -lt "$MIN_WORKERS" ]; then target=$MIN_WORKERS; fi
    log "queue_depth=$depth current=$current -> scaling DOWN to $target"
    scale_workers "$target"

  else
    log "queue_depth=$depth current=$current -> no action"
  fi

  sleep "$POLL_INTERVAL"
done
