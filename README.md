# W3Stor

Decentralized storage for AI agents and humans — Filecoin replication, IPFS pinning, x402 micropayments.

## What it does

Upload a file. It gets pinned to IPFS instantly via Pinata, then replicated across multiple Filecoin Storage Providers using the Store/Pull/Commit pattern. Pay per operation with x402 USDC micropayments. Talk to it in natural language or call the API directly.

Three protocols: **REST** (direct API), **A2A** (agent-to-agent), **MCP** (AI tool calling).

## Monorepo structure

```
apps/
  web/                 @w3stor/web       Next.js dashboard
packages/
  shared/              @w3stor/shared    Types, config, logger, errors
  db/                  @w3stor/db        Drizzle ORM, queries, migrations
  modules/             @w3stor/modules   Filecoin, Pinata, x402, queue
  sdk/                 @w3stor/sdk       AI SDK tools + A2A integration (npm)
  api/                 @w3stor/api       Hono API server
  workers/             @w3stor/workers   BullMQ background jobs
  cli/                 @w3stor/cli       CLI with MCP server (npm)
```

**Published packages:** `@w3stor/sdk` and `@w3stor/cli` are published to npm. Everything else is internal.

## Quick start

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://docs.docker.com/get-docker/) (PostgreSQL + Redis)
- [Pinata](https://app.pinata.cloud/developers/api-keys) API keys
- EVM wallet private key (x402 payments + Filecoin operations)
- AI gateway API key (OpenRouter, OpenAI, or any compatible provider)

### Setup

```bash
# Start Postgres + Redis
docker compose up -d

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
bun run db:migrate

# Start everything (API + workers + frontend)
bun run dev
```

The API server runs on `http://localhost:4000`, the frontend on `http://localhost:3000`.

### Start workers separately

Workers handle Filecoin SP replication, retrieval verification, and Pinata unpin after confirmation:

```bash
bun run worker
```

## Using the SDK

```bash
npm install @w3stor/sdk ai zod
```

### AI SDK tools

Drop storage capabilities into any AI SDK chat:

```typescript
import { createStorageAgentStream } from "@w3stor/sdk";
import { gateway } from "ai";

const result = createStorageAgentStream({
  model: gateway("openai/gpt-4o-mini"),
  messages,
  walletAddress: "0x...",
  apiUrl: "http://localhost:4000",
});
```

### Individual tools

```typescript
import { uploadTool, createCheckStatusTool, createListFilesTool } from "@w3stor/sdk";

// Use in any AI SDK agent
const tools = {
  upload: uploadTool,
  status: createCheckStatusTool({ apiUrl: "http://localhost:4000" }),
  files: createListFilesTool({ apiUrl: "http://localhost:4000" }),
};
```

### A2A protocol

```typescript
import { A2AServer, createAgentCard } from "@w3stor/sdk/a2a";
```

## Using the CLI

```bash
npm install -g @w3stor/cli

# Setup wallet
w3stor init --auto

# Upload (x402 payment handled automatically)
w3stor upload photo.jpg --tags "photos,backup"

# Check status
w3stor status bafkrei...

# List files
w3stor files --status fully_replicated

# Wallet balance (USDC on Base Sepolia)
w3stor wallet balance
```

### MCP server mode

The CLI doubles as an MCP server for AI agent integration:

```bash
# Start as MCP stdio server
w3stor --mcp

# Register in agent config
w3stor mcp add
```

## API reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/upload` | x402 | Upload file (multipart) |
| `GET` | `/status/:cid` | — | Replication status across SPs |
| `GET` | `/files` | — | List files by wallet |
| `POST` | `/attest/:cid` | x402 | Cryptographic attestation |
| `GET` | `/health` | — | Service health |
| `GET` | `/metrics` | — | System metrics |
| `POST` | `/a2a/jsonrpc` | — | A2A JSON-RPC endpoint |
| `GET` | `/.well-known/agent-card.json` | — | A2A discovery |

## Architecture

```
Client (CLI / SDK / Dashboard / A2A Agent)
  │
  ▼
Hono API Server (@w3stor/api)
  ├── Intent Detection (LLM via AI SDK gateway)
  ├── x402 Payment Verification
  └── Upload Pipeline
        │
        ├── IPNI Dedup Check
        ├── Pinata IPFS Pin (instant CID)
        └── CAR Build → BullMQ Queue
              │
              ▼
        Workers (@w3stor/workers)
          ├── filecoin-upload: Store/Pull/Commit to 4 SPs
          ├── retrieval-verify: On-chain verification
          └── pinata-unpin: Cleanup after 2+ SP confirmations
```

### Store/Pull/Commit pattern

1. Build CAR file to disk (streaming, no N*memory)
2. Primary SP receives the CAR via upload
3. Secondary SPs pull from primary
4. On-chain `addPieces` called per provider
5. Pinata pin removed after 2+ SP confirmations

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `PINATA_API_KEY` | Yes | Pinata API key |
| `PINATA_API_SECRET` | Yes | Pinata API secret |
| `PINATA_JWT` | Yes | Pinata JWT |
| `X402_EVM_PRIVATE_KEY` | Yes | EVM key for x402 payment facilitation |
| `X402_EVM_PAY_TO` | Yes | Wallet to receive payments |
| `FILECOIN_PRIVATE_KEY` | Yes | Key for Filecoin on-chain ops |
| `AI_GATEWAY_API_KEY` | Yes | AI gateway key (OpenRouter, etc.) |
| `AI_DEFAULT_MODEL` | No | Default LLM model (default: `openai/gpt-4o-mini`) |
| `PORT` | No | API port (default: 4000) |
| `CORS_ORIGIN` | No | CORS origin (default: `*`) |

## Scripts

```bash
bun run dev          # Start all services (turbo)
bun run build        # Build all packages
bun run typecheck    # TypeScript check all packages
bun run test         # Run all tests
bun run worker       # Start background workers
bun run db:migrate   # Run database migrations
bun run db:studio    # Open Drizzle Studio
```

## License

MIT
