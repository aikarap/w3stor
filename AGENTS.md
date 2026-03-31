# W3Stor — Agent Guide

This file helps AI agents (and humans) understand and work with the W3Stor codebase.

## What is W3Stor

Persistent agent memory and decentralized storage powered by Filecoin Onchain Cloud. Files are pinned to IPFS instantly, then replicated across 4 Filecoin Storage Providers. Each agent gets a sovereign knowledge graph (Neo4j) with semantic vector search across stored files. Payments happen via x402 micropayments (USDC on Base Sepolia). The agent exposes memory and storage through REST, A2A, MCP, and native SDK integrations for AI frameworks.

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
│   ├── graph/                   @w3stor/graph — Agent memory (Neo4j knowledge graphs + vector search)
│   ├── modules/                 @w3stor/modules — Filecoin, Pinata, x402, SIWE, BullMQ queue
│   ├── sdk/                     @w3stor/sdk — published npm package (AI SDK + ElizaOS + Mastra + A2A)
│   ├── api/                     @w3stor/api — Hono HTTP server (REST + A2A + SSE + Graph)
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
@w3stor/graph   (shared → Neo4j driver + Vercel AI SDK embeddings)
       ↓
@w3stor/modules (shared + db → Filecoin, Pinata, x402, SIWE, queue)
       ↓
@w3stor/sdk     (bundles shared + db + graph + modules for npm)
@w3stor/api     (shared + db + graph + modules + sdk)
@w3stor/workers (shared + db + modules)

@w3stor/cli     (standalone — talks to API via HTTP + x402 + SIWE)
@w3stor/web     (standalone — Next.js, talks to API via HTTP + SSE + SIWE)
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
| Graph | Neo4j 5 Community (knowledge graphs + vector indexes) |
| Blockchain | Viem 2 (EVM), Synapse SDK (Filecoin) |
| Payments | x402 Core + EVM (USDC on Base Sepolia) |
| Auth | SIWE (Sign-In with Ethereum) + JWT |
| AI | Vercel AI SDK 6 (embeddings: text-embedding-3-small) |
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

### Agent Memory (Knowledge Graph)
- Per-agent sovereign namespace — each wallet address owns a private graph
- File nodes scoped by `(walletAddress, cid)` compound key — same CID = separate nodes per agent
- Freeform relationship labels between files (e.g., `references`, `derived_from`, `contradicts`)
- Embeddings generated from file metadata (tags, description, filename) — 1536 dimensions, cosine similarity
- Vector index in Neo4j — no separate vector DB needed
- Graph add on upload is fire-and-forget — failures logged but never block uploads
- Semantic search + graph traversal + combined hybrid queries

### SIWE Auth
- Sign-In with Ethereum for unpaid graph operations (reads, deletes)
- Server-generated nonces (single-use, 5min TTL)
- JWT tokens (HS256, 24h expiry) — wallet address in `sub` claim
- SDK handles SIWE transparently — reactive refresh on 401
- x402 paid ops already prove wallet identity, no SIWE needed

### A2A Protocol
- Agent card at `/.well-known/agent-card.json`
- JSON-RPC endpoint at `/a2a/jsonrpc`
- 5 skills: upload, list, status, attest, conversational
- Supports both JSON action commands and natural language

### SDK Exports
- `@w3stor/sdk` — core tools + orchestrator
- `@w3stor/sdk/ai-sdk` — Vercel AI SDK tool factory (includes graph + batch tools)
- `@w3stor/sdk/elizaos` — ElizaOS plugin (actions: store, list, status, batch upload)
- `@w3stor/sdk/mastra` — Mastra framework tools (includes graph tools)
- `@w3stor/sdk/a2a` — A2A agent card + executor

## Development

```bash
docker compose up -d         # Start Postgres + Redis + Neo4j
bun install                  # Install all deps
cp .env.example .env         # Configure credentials (incl. NEO4J_*, OPENAI_API_KEY, SIWE_JWT_SECRET)
bun run db:migrate           # Run migrations
bun run dev                  # Start API + workers + web (Turbo)
```

- API: `http://localhost:4000`
- Web: `http://localhost:3000`
- Neo4j Browser: `http://localhost:7475`
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
| `packages/modules/src/siwe/` | SIWE nonce, JWT, verification |
| `packages/graph/src/client.ts` | Neo4j driver singleton |
| `packages/graph/src/embeddings.ts` | Embedding generation (Vercel AI SDK) |
| `packages/graph/src/mutations/` | Graph write operations (add, connect, remove) |
| `packages/graph/src/queries/` | Semantic search, traversal, graph view |
| `packages/api/src/routes/graph.ts` | Graph API routes |
| `packages/api/src/routes/auth.ts` | SIWE auth routes (nonce + verify) |
| `packages/api/src/routes/batch-upload.ts` | Batch upload with graph connections |
| `packages/api/src/middleware/siwe.ts` | SIWE JWT middleware |
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

### Add a new graph query/mutation
1. Add function in `packages/graph/src/queries/` or `packages/graph/src/mutations/`
2. Export from `packages/graph/src/index.ts`
3. Add API route in `packages/api/src/routes/graph.ts`
4. Register middleware in `packages/api/src/hono.ts` (x402 for writes, SIWE for reads)
5. Add SDK tool in `packages/sdk/src/integrations/ai-sdk.ts`
6. Add CLI command in `packages/cli/src/commands/graph.ts`

### Add a new background job
1. Add job type in `packages/shared/src/types/queue.ts`
2. Add enqueuer in `packages/modules/src/queue/jobs.ts`
3. Add processor in `packages/workers/src/`
4. Register worker in `packages/workers/src/index.ts`
