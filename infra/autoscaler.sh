#!/bin/sh
# Worker autoscaler sidecar
# Polls Redis queue depth + active job size + host memory and scales worker replicas.
# Memory-aware: never scales up if the VPS doesn't have enough free RAM.
# Graceful drain: gives workers 5 minutes to finish active jobs before removal.
set -eu

# Configuration (all from ENV with defaults)
MIN_WORKERS="${AUTOSCALER_MIN_WORKERS:-1}"
MAX_WORKERS="${AUTOSCALER_MAX_WORKERS:-2}"
POLL_INTERVAL="${AUTOSCALER_POLL_INTERVAL:-30}"
SCALE_UP_THRESHOLD="${AUTOSCALER_SCALE_UP_THRESHOLD:-5}"
SCALE_DOWN_THRESHOLD="${AUTOSCALER_SCALE_DOWN_THRESHOLD:-2}"
COOLDOWN="${AUTOSCALER_COOLDOWN:-60}"
COMPOSE_FILE="${COMPOSE_FILE:-/compose.yml}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-w3stor}"
# Scale up when total active bytes exceed this (default 500 MB)
ACTIVE_BYTES_THRESHOLD="${AUTOSCALER_ACTIVE_BYTES_THRESHOLD:-524288000}"
# Memory per worker container in MB — must match docker-compose mem_limit
WORKER_MEM_MB="${AUTOSCALER_WORKER_MEM_MB:-1536}"
# Minimum free host RAM (MB) required before scaling up — safety buffer for OS + other services
MIN_FREE_RAM_MB="${AUTOSCALER_MIN_FREE_RAM_MB:-512}"
# Grace period for docker stop (seconds) — workers get this long to finish active jobs
STOP_GRACE_SECONDS="${AUTOSCALER_STOP_GRACE_SECONDS:-300}"
# Auto-repair: consecutive idle polls before triggering repair (default: 4 = ~2 min at 30s poll)
REPAIR_IDLE_THRESHOLD="${AUTOSCALER_REPAIR_IDLE_THRESHOLD:-4}"
# Cooldown between repair triggers (seconds) — prevent spamming repair jobs
REPAIR_COOLDOWN="${AUTOSCALER_REPAIR_COOLDOWN:-300}"

# Parse Redis URL: redis://host:port
REDIS_HOST=$(echo "${REDIS_URL:-redis://redis:6379}" | sed 's|redis://||' | cut -d: -f1)
REDIS_PORT=$(echo "${REDIS_URL:-redis://redis:6379}" | sed 's|redis://||' | cut -d: -f2)

last_scale_time=0
idle_polls=0
last_repair_time=0

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] autoscaler: $*"
}

get_queue_depth() {
  waiting=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LLEN "bull:filecoin-operations:wait" 2>/dev/null || echo 0)
  delayed=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZCARD "bull:filecoin-operations:delayed" 2>/dev/null || echo 0)
  # Priority queue uses a sorted set instead of a list
  priority=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZCARD "bull:filecoin-operations:priority" 2>/dev/null || echo 0)
  echo $((waiting + delayed + priority))
}

get_active_count() {
  active=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LLEN "bull:filecoin-operations:active" 2>/dev/null || echo 0)
  echo "$active"
}

get_active_bytes() {
  bytes=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" GET "w3stor:worker:active-bytes" 2>/dev/null || echo 0)
  if [ -z "$bytes" ] || [ "$bytes" = "(nil)" ]; then
    echo 0
  else
    # Clamp negative values to 0 (stale from crash)
    if [ "$bytes" -lt 0 ] 2>/dev/null; then
      redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SET "w3stor:worker:active-bytes" "0" >/dev/null 2>&1
      echo 0
    else
      echo "$bytes"
    fi
  fi
}

# Read available memory from the host's /proc/meminfo (mounted at /host/meminfo).
# Returns available MB. Falls back to 9999 (always allow) if not mounted.
get_available_ram_mb() {
  if [ -f /host/meminfo ]; then
    avail_kb=$(awk '/MemAvailable/ {print $2}' /host/meminfo 2>/dev/null || echo 0)
    echo $((avail_kb / 1024))
  else
    # Can't read host memory — assume enough (don't block scaling)
    echo 9999
  fi
}

get_current_replicas() {
  count=$(docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps --status running workers 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
  if [ -z "$count" ] || [ "$count" -eq 0 ] 2>/dev/null; then
    echo 0
  else
    echo "$count"
  fi
}

# Check if adding a worker would exceed available RAM.
# Requires: WORKER_MEM_MB + MIN_FREE_RAM_MB must be available.
can_afford_worker() {
  available=$(get_available_ram_mb)
  required=$((WORKER_MEM_MB + MIN_FREE_RAM_MB))
  if [ "$available" -ge "$required" ]; then
    return 0
  else
    log "NOT ENOUGH RAM: available=${available}MB, need=${required}MB (worker=${WORKER_MEM_MB}MB + buffer=${MIN_FREE_RAM_MB}MB)"
    return 1
  fi
}

scale_up() {
  target=$1
  now=$(date +%s)
  elapsed=$((now - last_scale_time))

  if [ "$elapsed" -lt "$COOLDOWN" ]; then
    log "cooldown active (${elapsed}s/${COOLDOWN}s), skipping scale up to $target"
    return
  fi

  # Memory gate: don't scale up if the VPS can't afford another worker
  if ! can_afford_worker; then
    log "scale up to $target BLOCKED by memory constraint"
    return
  fi

  log "scaling UP workers to $target"
  # --no-deps: don't restart/re-check postgres, redis, neo4j — only touch the workers service
  # --no-recreate: don't touch existing running workers
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d --no-deps --no-recreate --scale workers="$target" workers 2>&1 | while read -r line; do log "  $line"; done
  last_scale_time=$(date +%s)
}

# Signal workers to run auto-repair via a Redis key.
# The worker polls this key and enqueues an sp-retry-check job at lowest priority
# (priority=100) so any incoming user upload (priority 1-20) preempts it.
trigger_repair() {
  now=$(date +%s)
  elapsed=$((now - last_repair_time))

  if [ "$elapsed" -lt "$REPAIR_COOLDOWN" ]; then
    log "repair cooldown active (${elapsed}s/${REPAIR_COOLDOWN}s), skipping"
    return
  fi

  # Check if repair is already in progress or signaled
  existing=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" EXISTS "w3stor:auto-repair:signal" 2>/dev/null || echo 0)
  if [ "$existing" = "1" ]; then
    log "repair already signaled, skipping"
    return
  fi

  # Signal repair — worker picks this up and enqueues via BullMQ API properly
  # TTL = 10 min so stale signals auto-expire
  redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SET "w3stor:auto-repair:signal" "$(date +%s)" EX 600 >/dev/null 2>&1

  last_repair_time=$(date +%s)
  log "AUTO-REPAIR signaled — worker will pick up and enqueue at lowest priority"
}

scale_down() {
  target=$1
  current=$2
  now=$(date +%s)
  elapsed=$((now - last_scale_time))

  if [ "$elapsed" -lt "$COOLDOWN" ]; then
    log "cooldown active (${elapsed}s/${COOLDOWN}s), skipping scale down to $target"
    return
  fi

  # Graceful drain: give workers time to finish active jobs.
  # docker stop --time sends SIGTERM, waits N seconds, then SIGKILL.
  # The worker's shutdown handler calls worker.close() which stops accepting
  # new jobs and waits for active ones to complete.
  i=$current
  while [ "$i" -gt "$target" ]; do
    container="${COMPOSE_PROJECT}-workers-${i}"
    log "draining $container (grace=${STOP_GRACE_SECONDS}s)"
    docker stop --time "$STOP_GRACE_SECONDS" "$container" 2>/dev/null || true
    docker rm "$container" 2>/dev/null || true
    i=$((i - 1))
  done

  last_scale_time=$(date +%s)
}

# Source env for compose interpolation (passwords etc.)
if [ -f "/.env.prod" ]; then
  set -a && . /.env.prod && set +a
fi

# Install redis-cli if not present
if ! command -v redis-cli >/dev/null 2>&1; then
  apk add --no-cache redis >/dev/null 2>&1
fi

log "started (min=$MIN_WORKERS max=$MAX_WORKERS worker_mem=${WORKER_MEM_MB}MB min_free=${MIN_FREE_RAM_MB}MB up_threshold=$SCALE_UP_THRESHOLD down_threshold=$SCALE_DOWN_THRESHOLD bytes_threshold=$ACTIVE_BYTES_THRESHOLD poll=${POLL_INTERVAL}s cooldown=${COOLDOWN}s drain=${STOP_GRACE_SECONDS}s repair_idle=${REPAIR_IDLE_THRESHOLD} repair_cooldown=${REPAIR_COOLDOWN}s)"

# Wait for Redis to be ready
until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PING 2>/dev/null | grep -q PONG; do
  log "waiting for Redis..."
  sleep 5
done

log "redis connected"

while true; do
  depth=$(get_queue_depth)
  active=$(get_active_count)
  active_bytes=$(get_active_bytes)
  current=$(get_current_replicas)
  available_ram=$(get_available_ram_mb)

  # Scale up if: queue depth exceeds threshold OR active bytes exceed threshold
  should_scale_up=false
  scale_reason=""

  if [ "$depth" -gt "$SCALE_UP_THRESHOLD" ]; then
    should_scale_up=true
    scale_reason="queue_depth=$depth > $SCALE_UP_THRESHOLD"
  elif [ "$active_bytes" -gt "$ACTIVE_BYTES_THRESHOLD" ]; then
    should_scale_up=true
    scale_reason="active_bytes=$active_bytes > $ACTIVE_BYTES_THRESHOLD"
  fi

  if [ "$should_scale_up" = true ] && [ "$current" -lt "$MAX_WORKERS" ]; then
    target=$((current + 1))
    if [ "$target" -gt "$MAX_WORKERS" ]; then target=$MAX_WORKERS; fi
    log "queue_depth=$depth active=$active active_bytes=$active_bytes ram_avail=${available_ram}MB current=$current -> scaling UP to $target ($scale_reason)"
    scale_up "$target"

  elif [ "$depth" -lt "$SCALE_DOWN_THRESHOLD" ] && [ "$active" -eq 0 ] && [ "$current" -gt "$MIN_WORKERS" ]; then
    target=$((current - 1))
    if [ "$target" -lt "$MIN_WORKERS" ]; then target=$MIN_WORKERS; fi
    log "queue_depth=$depth active=$active active_bytes=$active_bytes ram_avail=${available_ram}MB current=$current -> scaling DOWN to $target"
    scale_down "$target" "$current"

  else
    log "queue_depth=$depth active=$active active_bytes=${active_bytes} ram_avail=${available_ram}MB current=$current -> no action"
  fi

  # --- Auto-repair: trigger when system is idle ---
  # Idle = 1 worker, no active jobs, no waiting/priority jobs
  # Delayed jobs (scheduled repeatable like sp-retry-check) don't count as active demand
  waiting_depth=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LLEN "bull:filecoin-operations:wait" 2>/dev/null || echo 0)
  priority_depth=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZCARD "bull:filecoin-operations:priority" 2>/dev/null || echo 0)
  actionable_depth=$((waiting_depth + priority_depth))
  if [ "$current" -le "$MIN_WORKERS" ] && [ "$active" -eq 0 ] && [ "$actionable_depth" -eq 0 ]; then
    idle_polls=$((idle_polls + 1))
    if [ "$idle_polls" -ge "$REPAIR_IDLE_THRESHOLD" ]; then
      log "system idle for ${idle_polls} polls — checking for repair work"
      trigger_repair
      idle_polls=0  # reset after triggering
    fi
  else
    # Any real activity resets the idle counter
    idle_polls=0
    # Clear repair signal if user work arrived (repair yields to uploads)
    if [ "$actionable_depth" -gt 0 ] || [ "$active" -gt 0 ]; then
      redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" DEL "w3stor:auto-repair:signal" >/dev/null 2>&1
    fi
  fi

  sleep "$POLL_INTERVAL"
done
