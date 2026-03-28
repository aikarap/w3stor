# Contributing to W3Stor

## Development setup

```bash
# Clone and install
git clone https://github.com/aikarap/w3stor.git
cd w3stor
bun install

# Start infrastructure
docker compose up -d

# Configure environment
cp .env.example .env

# Run migrations
bun run db:migrate

# Start dev (all packages)
bun run dev
```

## Monorepo layout

This is a Bun workspace monorepo managed with [Turborepo](https://turbo.build).

| Package | Scope | Published |
|---------|-------|-----------|
| `packages/shared` | Types, config, logger, errors | No (internal) |
| `packages/db` | Drizzle ORM, migrations, queries | No (internal) |
| `packages/modules` | Filecoin, Pinata, x402, queue | No (internal) |
| `packages/sdk` | AI SDK tools + A2A integration | **Yes** (`@w3stor/sdk`) |
| `packages/api` | Hono API server | No (internal) |
| `packages/workers` | BullMQ background jobs | No (internal) |
| `packages/cli` | CLI + MCP server | **Yes** (`@w3stor/cli`) |
| `apps/web` | Next.js dashboard | No (deployed) |

### Dependency graph

```
@w3stor/shared  (no deps)
    ↑
@w3stor/db  (depends on shared)
    ↑
@w3stor/modules  (depends on shared, db)
    ↑
@w3stor/sdk  (depends on shared, db, modules — bundled for npm)
@w3stor/api  (depends on shared, db, modules, sdk)
@w3stor/workers  (depends on shared, db, modules)
@w3stor/web  (depends on shared, sdk)

@w3stor/cli  (standalone — no workspace deps)
```

## Package publishing

### Published packages

Only `@w3stor/sdk` and `@w3stor/cli` are published to npm. All other packages are private workspace dependencies.

### How the SDK build works

The SDK depends on internal packages (`@w3stor/shared`, `@w3stor/db`, `@w3stor/modules`) that aren't published. To solve this, `bun build` **bundles** these workspace dependencies into the output. External peer deps (`ai`, `zod`) are kept external so consumers provide their own versions.

```bash
# Build the SDK
bun --filter @w3stor/sdk build

# Output: packages/sdk/dist/
#   index.js    — main entry (tools, orchestrator, types)
#   ai.js       — AI SDK integration helpers
#   a2a.js      — A2A protocol (agent card, executor, conversation handler)
#   mastra.js   — Mastra framework adapter
```

Types are shipped as source `.ts` files (same approach as Drizzle ORM). Consumers using `moduleResolution: "bundler"` get full type inference.

### How the CLI build works

The CLI has no workspace dependencies. `bun build` compiles to a single `dist/index.js` with all internal code bundled, keeping runtime deps (`incur`, `viem`, `@x402/*`, etc.) external.

```bash
bun --filter @w3stor/cli build
```

### Publishing manually

```bash
# 1. Bump version
cd packages/sdk  # or packages/cli
# Edit version in package.json

# 2. Build
bun run build

# 3. Dry run to verify contents
npm publish --dry-run

# 4. Publish
npm publish
```

### Publishing via GitHub Actions

A `workflow_dispatch` workflow exists at `.github/workflows/publish.yml` but is currently deactivated (manual trigger only). To use it:

1. Add an `NPM_TOKEN` secret to the repository
2. Go to Actions > "Publish Packages" > "Run workflow"
3. Select which package to publish and whether to dry-run

To enable automated publishing on releases, uncomment the `release` trigger in the workflow file.

### Versioning

We use manual versioning (edit `package.json` directly). No changesets or automated version bumps yet. Follow semver:

- **patch** (0.1.x): bug fixes, docs
- **minor** (0.x.0): new features, non-breaking changes
- **major** (x.0.0): breaking API changes

## Deployment

### Service architecture

A production deployment runs three processes:

1. **API server** (`@w3stor/api`) — Hono HTTP server handling REST, A2A, and WebSocket connections
2. **Workers** (`@w3stor/workers`) — BullMQ workers processing Filecoin uploads, verification, and cleanup
3. **Frontend** (`@w3stor/web`) — Next.js dashboard (optional, can be deployed to Vercel/Cloudflare)

Plus two infrastructure services:

4. **PostgreSQL** — primary database (users, files, conversations, SP status)
5. **Redis** — BullMQ job queue + pub/sub for real-time file status updates

### Docker Compose (development)

```bash
docker compose up -d    # Postgres + Redis
bun run dev             # API + workers + frontend via Turbo
```

### Production deployment

For production, you need to deploy the API server, workers, and optionally the frontend separately.

**API server:**

```bash
bun run build
bun --filter @w3stor/api start
# Or with a process manager:
# PORT=4000 bun packages/api/src/index.ts
```

**Workers:**

```bash
bun --filter @w3stor/workers start
# Or:
# bun packages/workers/src/index.ts
```

**Frontend:**

```bash
bun --filter @w3stor/web build
bun --filter @w3stor/web start
# Or deploy to Vercel: connect the repo and set root directory to apps/web
```

### Environment

All services share the same `.env` file. In production, set these via your platform's secret management:

- `DATABASE_URL` — PostgreSQL connection string (use connection pooling in production)
- `REDIS_URL` — Redis connection string
- `PINATA_JWT` — Pinata API access
- `X402_EVM_PRIVATE_KEY` — x402 payment signing key
- `FILECOIN_PRIVATE_KEY` — Filecoin on-chain operation key
- `AI_GATEWAY_API_KEY` — LLM provider key

See `.env.example` for the full list.

## Worker scaling

Workers are the main scaling lever. They process three job types via BullMQ:

| Job type | What it does | Duration | CPU | I/O |
|----------|-------------|----------|-----|-----|
| `filecoin-upload` | Build CAR, upload to primary SP, wait for secondaries to pull | 30s–5min | Low | High (disk + network) |
| `retrieval-verify` | Check on-chain SP status | 1–10s | Low | Network |
| `pinata-unpin` | Remove IPFS pin after SP confirmations | <1s | Minimal | Network |

### Scaling strategies

#### Single worker (default)

One worker process handles all three job types. Good for development and low-traffic production:

```bash
bun run worker
```

BullMQ processes jobs concurrently within a single worker (default concurrency: 5).

#### Horizontal scaling (multiple workers)

Run multiple worker processes against the same Redis. BullMQ handles job distribution automatically — no coordination needed:

```bash
# Process 1
WORKER_CONCURRENCY=10 bun run worker

# Process 2 (same or different machine)
WORKER_CONCURRENCY=10 bun run worker
```

Each worker picks jobs from the shared Redis queue. Jobs are processed exactly once (BullMQ guarantees). Scale by adding more worker processes.

#### Job-type isolation

For high-traffic deployments, dedicate workers to specific job types to prevent slow Filecoin uploads from blocking fast verification jobs:

```bash
# Heavy lifters: Filecoin SP uploads (long-running, I/O bound)
WORKER_QUEUES=filecoin-upload WORKER_CONCURRENCY=20 bun run worker

# Fast lane: verification + cleanup (quick, low resource)
WORKER_QUEUES=retrieval-verify,pinata-unpin WORKER_CONCURRENCY=50 bun run worker
```

#### Auto-scaling heuristics

Monitor these BullMQ metrics to decide when to scale:

| Metric | Scale up when | Scale down when |
|--------|--------------|-----------------|
| `waiting` count | > 100 jobs queued | < 10 jobs queued |
| `active` count | = concurrency limit | < 50% of limit |
| Job completion time | p95 > 2x normal | p95 < normal |

#### Resource requirements per worker

| Deployment | Workers | Concurrency | RAM | Handles |
|-----------|---------|-------------|-----|---------|
| Dev/testing | 1 | 5 | 256 MB | ~50 uploads/hour |
| Small production | 2 | 10 each | 512 MB each | ~500 uploads/hour |
| Medium production | 4 (2 upload, 2 verify) | 20 each | 1 GB each | ~2,000 uploads/hour |
| Large production | 8+ (isolated by type) | 20–50 each | 1–2 GB each | ~10,000+ uploads/hour |

### Queue monitoring

BullMQ provides built-in metrics. For a production dashboard, use [Bull Board](https://github.com/felixmosh/bull-board):

```typescript
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
```

Or query Redis directly:

```bash
# Pending jobs
redis-cli LLEN bull:filecoin-upload:wait

# Active jobs
redis-cli SCARD bull:filecoin-upload:active
```

## Database

### Migrations

We use Drizzle ORM with `drizzle-kit` for migrations:

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Open Drizzle Studio (browser-based DB explorer)
bun run db:studio
```

Schema files are in `packages/db/src/schema/`. After editing a schema file, run `db:generate` to create a migration, then `db:migrate` to apply it.

### Key tables

| Table | Primary key | Purpose |
|-------|-------------|---------|
| `users` | `wallet_address` (text) | User profiles |
| `files` | `cid` (text) | Content-addressed file metadata |
| `user_files` | `(wallet_address, cid)` | Per-user file ownership + metadata |
| `file_sp_status` | `(cid, provider_id)` | Replication status per SP |
| `conversations` | `id` (uuid) | Multi-turn conversation state |

Natural keys (CID, wallet address) are used instead of UUIDs where possible.

## Code style

- **Runtime:** Bun (not Node)
- **Language:** TypeScript (strict mode)
- **Formatting:** Default Bun/TypeScript conventions
- **Imports:** Use workspace package names (`@w3stor/shared`), not relative paths across packages
- **Types:** Prefer source `.ts` exports for workspace packages (Bun resolves them directly)

## Testing

```bash
# All tests
bun run test

# Specific package
bun --filter @w3stor/sdk test
bun --filter @w3stor/api test

# Watch mode
bun --filter @w3stor/sdk test -- --watch
```

Tests use `vitest` (configured per package).
