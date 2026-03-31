# W3Stor — Agent Guide

This file helps AI agents (and humans) understand and work with the W3Stor codebase.

## What is W3Stor

A decentralized storage agent powered by Filecoin Onchain Cloud. Files are pinned to IPFS instantly, then replicated across 4 Filecoin Storage Providers. Payments happen via x402 micropayments (USDC on Base Sepolia). The agent exposes storage through REST, A2A, MCP, and native SDK integrations for AI frameworks.

**Live:** [w3stor.xyz](https://w3stor.xyz) · **Docs:** [w3stor.xyz/docs](https://w3stor.xyz/docs)

## Repository Structure

```
w3stor/                          Turborepo monorepo (Bun workspace)
├── apps/
│   └── web/                     @w3stor/web — Next.js 16 dashboard + docs + workflows
│
├── packages/
│   ├── shared/                  @w3stor/shared — types, config (Zod), logger, errors (zero deps)
│   ├── db/                      @w3stor/db — Drizzle ORM schema + queries (PostgreSQL)
│   ├── modules/                 @w3stor/modules — Filecoin, Pinata, x402, BullMQ queue
│   ├── sdk/                     @w3stor/sdk — published npm package (AI SDK + ElizaOS + Mastra + A2A)
│   ├── api/                     @w3stor/api — Hono HTTP server (REST + A2A + SSE)
│   ├── workers/                 @w3stor/workers — BullMQ job processors
│   └── cli/                     @w3stor/cli — published npm package (incur CLI + MCP server)
│
├── skills/
│   └── w3stor/SKILL.md          Claude Code skill definition
│
├── Dockerfile                   Multi-stage Bun build
├── docker-compose.yml           Dev infrastructure (Postgres + Redis)
├── docker-compose.prod.yml      Prod infrastructure (+ Caddy)
├── Caddyfile                    Reverse proxy + TLS
├── deploy.sh                    Deployment script
├── turbo.json                   Build orchestration
└── biome.json                   Linting + formatting
```

## Dependency Graph

```
@w3stor/shared  (no deps — types, config, logger, errors)
       ↓
@w3stor/db      (shared → Drizzle ORM → PostgreSQL)
       ↓
@w3stor/modules (shared + db → Filecoin, Pinata, x402, queue)
       ↓
@w3stor/sdk     (bundles shared + db + modules for npm)
@w3stor/api     (shared + db + modules + sdk)
@w3stor/workers (shared + db + modules)

@w3stor/cli     (standalone — talks to API via HTTP + x402)
@w3stor/web     (standalone — Next.js, talks to API via HTTP + SSE)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.2 |
| Language | TypeScript 5.7 |
| Build | Turborepo |
| HTTP | Hono 4 |
| Frontend | Next.js 16, React 19, Tailwind 4 |
| ORM | Drizzle 0.39 (PostgreSQL) |
| Queue | BullMQ 5 (Redis) |
| Blockchain | Viem 2 (EVM), Synapse SDK (Filecoin) |
| Payments | x402 Core + EVM (USDC on Base Sepolia) |
| AI | Vercel AI SDK 6 |
| CLI | incur framework |
| Validation | Zod |
| Linting | Biome |

## Key Concepts

### Upload Pipeline
1. Client sends file + x402 payment to `POST /upload`
2. Server pins to IPFS via Pinata (instant CID)
3. BullMQ job enqueued for Filecoin replication
4. Worker: builds CAR → stores on primary SP → secondary SPs pull → on-chain commit per SP
5. SSE stream publishes status per SP: `pending → storing → stored → verified`
6. Pinata pin removed after 2+ SP confirmations

### x402 Payment Flow
1. Client sends request without payment
2. Server returns `402 Payment Required` with challenge
3. Client signs challenge with EVM private key
4. Client retries with `Payment-Signature` header
5. Server verifies signature, processes request

### A2A Protocol
- Agent card at `/.well-known/agent-card.json`
- JSON-RPC endpoint at `/a2a/jsonrpc`
- 5 skills: upload, list, status, attest, conversational
- Supports both JSON action commands and natural language

### SDK Exports
- `@w3stor/sdk` — core tools + orchestrator
- `@w3stor/sdk/ai-sdk` — Vercel AI SDK tool factory
- `@w3stor/sdk/elizaos` — ElizaOS plugin (3 actions)
- `@w3stor/sdk/mastra` — Mastra framework tools
- `@w3stor/sdk/a2a` — A2A agent card + executor

## Development

```bash
docker compose up -d         # Start Postgres + Redis
bun install                  # Install all deps
cp .env.example .env         # Configure credentials
bun run db:migrate           # Run migrations
bun run dev                  # Start API + workers + web (Turbo)
```

- API: `http://localhost:4000`
- Web: `http://localhost:3000`
- DB Studio: `bun run db:studio`

## Important Files

| File | Purpose |
|------|---------|
| `packages/api/src/hono.ts` | Main HTTP app — all routes + middleware |
| `packages/api/src/routes/upload.ts` | Upload endpoint (x402 protected) |
| `packages/workers/src/filecoin-upload.ts` | Filecoin replication worker |
| `packages/modules/src/filecoin/upload-car.ts` | Store/Pull/Commit implementation |
| `packages/modules/src/x402/facilitator.ts` | x402 payment setup |
| `packages/modules/src/x402/pricing.ts` | Dynamic pricing logic |
| `packages/sdk/src/integrations/ai-sdk.ts` | AI SDK tool factory |
| `packages/sdk/src/integrations/elizaos.ts` | ElizaOS plugin |
| `packages/sdk/src/integrations/mastra.ts` | Mastra tools |
| `packages/sdk/src/a2a/agent-card.ts` | A2A agent metadata |
| `packages/db/src/schema/` | All database tables |
| `packages/shared/src/types/` | Shared TypeScript types |
| `packages/cli/src/commands/` | CLI command implementations |

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Wallet addresses |
| `files` | File metadata (CID, status, size, piece CID) |
| `fileSPStatus` | Per-SP replication status + tx hash |
| `userFiles` | User ↔ File relationship + payment tracking |
| `conversations` | Multi-turn dialogue state |
| `workflows` | Workflow definitions (nodes/edges as JSONB) |
| `workflowExecutions` | Execution history + cost |
| `workflowExecutionLogs` | Per-node execution logs |

## Conventions

- **Monorepo** — all code in one repo, Turborepo for builds
- **Bun** — runtime, package manager, bundler, test runner
- **Biome** — linting and formatting (not ESLint/Prettier)
- **Drizzle** — SQL-first ORM (not Prisma)
- **Hono** — lightweight HTTP (not Express)
- **incur** — CLI framework (not Commander/yargs)
- **Zod** — runtime validation everywhere
- **No custom smart contracts** — integrates with existing Filecoin + x402 infra
- **Conventional commits** — `feat:`, `fix:`, `docs:`, etc.
- **Semantic release** — automated npm publishing via CI

## Common Tasks

### Add a new API route
1. Create route file in `packages/api/src/routes/`
2. Register in `packages/api/src/hono.ts`
3. Add x402 middleware if payment required

### Add a new SDK integration
1. Create integration in `packages/sdk/src/integrations/`
2. Add export path in `packages/sdk/package.json`
3. Add build entry in SDK build config
4. Add docs page in `apps/web/src/app/docs/`

### Add a new CLI command
1. Create command in `packages/cli/src/commands/`
2. Register in `packages/cli/src/index.ts`
3. Automatically available as MCP tool

### Add a new database table
1. Add schema in `packages/db/src/schema/`
2. Export from schema index
3. Run `bun run db:generate` then `bun run db:migrate`
4. Add query functions in `packages/db/src/queries/`

### Add a new background job
1. Add job type in `packages/shared/src/types/queue.ts`
2. Add enqueuer in `packages/modules/src/queue/jobs.ts`
3. Add processor in `packages/workers/src/`
4. Register worker in `packages/workers/src/index.ts`
