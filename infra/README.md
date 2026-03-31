# W3Stor Infrastructure

## Quick Start

1. Copy `deploy.env.example` to `deploy.env` and fill in your values:
   ```bash
   cp infra/deploy.env.example infra/deploy.env
   ```

2. Deploy:
   ```bash
   bun infra/deploy.ts deploy
   ```

## Deploy Commands

| Command | Description |
|---------|-------------|
| `bun infra/deploy.ts deploy` | Full deploy (env sync + rsync + build + migrate + restart) |
| `bun infra/deploy.ts restart [service]` | Restart all services or a specific one |
| `bun infra/deploy.ts logs [service]` | Tail logs (default: all services) |
| `bun infra/deploy.ts status` | Show running services |
| `bun infra/deploy.ts env` | Sync `deploy.env` to server without deploying |
| `bun infra/deploy.ts scale workers 3` | Manually scale worker replicas |

## ENV Management

Production environment variables live in `infra/deploy.env` (gitignored).
A committed template is provided at `infra/deploy.env.example`.

When you run any deploy command, the script syncs `deploy.env` to the server
as `.env.prod`. No SSH needed to update config.

## Worker Autoscaler

A sidecar container that monitors Redis queue depth and scales worker replicas.

**How it works:**
- Polls BullMQ queue (`filecoin-operations`) every N seconds
- When `waiting + delayed > SCALE_UP_THRESHOLD`: adds a worker replica
- When `waiting + delayed < SCALE_DOWN_THRESHOLD`: removes a worker replica
- Always keeps at least `AUTOSCALER_MIN_WORKERS` running (default: 1)
- Never exceeds `AUTOSCALER_MAX_WORKERS` (default: 4)
- Enforces a cooldown between scale actions to prevent flapping

**Configuration (in `deploy.env`):**

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTOSCALER_MIN_WORKERS` | 1 | Minimum worker replicas (never scales below) |
| `AUTOSCALER_MAX_WORKERS` | 4 | Maximum worker replicas (never scales above) |
| `AUTOSCALER_POLL_INTERVAL` | 30 | Seconds between queue depth checks |
| `AUTOSCALER_SCALE_UP_THRESHOLD` | 10 | Queue depth that triggers scale up |
| `AUTOSCALER_SCALE_DOWN_THRESHOLD` | 3 | Queue depth that triggers scale down |
| `AUTOSCALER_COOLDOWN` | 60 | Seconds between scale actions |

**Monitoring:**
```bash
# Check autoscaler logs
bun infra/deploy.ts logs autoscaler

# Check current worker count
bun infra/deploy.ts status

# Manual override
bun infra/deploy.ts scale workers 3
```

## Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage Bun build (shared by api, workers, migrate) |
| `docker-compose.yml` | Dev infrastructure (Postgres + Redis + Neo4j) |
| `docker-compose.prod.yml` | Prod infrastructure (+ Caddy + autoscaler) |
| `Caddyfile` | Reverse proxy + TLS |
| `deploy.ts` | Bun deploy script |
| `deploy.env` | Your production env vars (gitignored) |
| `deploy.env.example` | Template with placeholder values |
| `autoscaler.sh` | Worker autoscaler sidecar script |
