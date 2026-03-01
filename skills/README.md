# w3stor Skills Guide

Everything added in `cookies v0` — CLI commands, MCP integration, and how to test each feature.

## Prerequisites

```sh
# 1. Build the CLI
bun run skills:build

# 2. Link the command globally (makes `w3stor` available everywhere)
bun link

# 3. Start the server (separate terminal)
bun run dev

# 4. Initialize with your test wallet
w3stor init --privateKey $TEST_PRIVATE_KEY
```

> If you skip `bun link`, use `./dist/skills/index.js` instead of `w3stor`.

> **Note:** `upload` and `attest` require USDC on Base Sepolia in your wallet.
> The x402 payment is handled automatically — no manual approval needed.

---

## CLI Commands

### `init` — Configure wallet and server

```sh
# With a private key
w3stor init --privateKey 0xabc...def

# From PRIVATE_KEY env var
PRIVATE_KEY=0x... w3stor init --auto

# From a Foundry cast keystore
w3stor init --keystore ~/.foundry/keystores/default

# Custom server URL (default: http://localhost:4000)
w3stor init --serverUrl https://my-server.example.com
```

**Test it:**

```sh
w3stor init --privateKey 0xYOUR_PRIVATE_KEY_HERE
# Expected: configured: true, wallet address shown
```

Config is stored locally in `~/.config/w3stor/config.json`. Private keys never leave your machine.

---

### `health` — Check server status

```sh
w3stor health
```

**Test it:**

```sh
# With server running
w3stor health
# Expected: status: healthy, database: true, redis: true, pinata: true

# With server stopped
w3stor health
# Expected: CONNECTION_FAILED error
```

**API:** `GET /health`

---

### `upload` — Upload a file (x402 payment)

```sh
# Basic upload
w3stor upload photo.jpg

# With tags
w3stor upload data.csv --tags "dataset,public"

# With JSON metadata
w3stor upload report.pdf --metadata '{"project":"alpha"}'

# Both
w3stor upload doc.txt --tags "docs" --metadata '{"version":"2"}'
```

**Test it:**

```sh
# Create a test file
echo "hello web3 storage" > /tmp/test-upload.txt

# Upload it
w3stor upload /tmp/test-upload.txt --tags "test"
# Expected: cid, status, size, filename in output

# Upload a non-existent file
w3stor upload /tmp/does-not-exist.txt
# Expected: FILE_NOT_FOUND error
```

**API:** `POST /upload` (with x402 payment flow)

---

### `files` — List uploaded files

```sh
# List all files
w3stor files

# Filter by status
w3stor files --status stored
w3stor files --status pinata_pinned
w3stor files --status fully_replicated

# Search filenames
w3stor files --search "report"

# Filter by tags
w3stor files --tags "dataset"

# Pagination
w3stor files --page 2 --limit 5

# Check another wallet's files
w3stor files --wallet 0x...
```

**Test it:**

```sh
# After uploading a file, list all files
w3stor files
# Expected: files array with cid, filename, size, status, createdAt, spCount

# Search for a specific file
w3stor files --search "test-upload"
# Expected: filtered results matching the search term

# Filter by status
w3stor files --status pinata_pinned
# Expected: only files with that status
```

**Valid status values:** `pinata_pinned`, `uploading`, `stored`, `fully_replicated`, `failed`

**API:** `GET /files?wallet=...&page=...&limit=...&status=...&search=...&tags=...`

---

### `status` — Check file replication status

```sh
w3stor status <cid>
```

**Test it:**

```sh
# Use a CID from a previous upload
w3stor status bafkrei...
# Expected: cid, status, pinataStatus, filecoinStatus (SP map), verifiedSPs, createdAt

# Non-existent CID
w3stor status bafkreiinvalidcid
# Expected: NOT_FOUND error
```

**API:** `GET /status/{cid}`

---

### `attest` — Get a storage attestation (x402 payment)

```sh
w3stor attest <cid>
```

**Test it:**

```sh
# Use a CID that has been replicated to SPs
w3stor attest bafkrei...
# Expected: attestation object with cid, pieceCid, providers, replicationStatus, verification hashes

# Use a CID that hasn't been replicated yet
w3stor attest bafkrei...
# Expected: INSUFFICIENT_REPLICATION error
```

**API:** `POST /attest/{cid}` (with x402 payment flow)

---

### `wallet balance` — Check USDC balance

```sh
# Your wallet
w3stor wallet balance

# Another wallet
w3stor wallet balance --wallet 0x...
```

**Test it:**

```sh
w3stor wallet balance
# Expected: wallet address, usdc (formatted), usdcRaw (wei), chain info
# Note: Requires Base Sepolia RPC access (chainId 84532)
```

**Chain:** Base Sepolia | **Token:** USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)

---

### `wallet address` — Show configured wallet

```sh
w3stor wallet address
```

**Test it:**

```sh
w3stor wallet address
# Expected: wallet: 0xYourWalletAddress
```

---

## MCP Integration

The CLI doubles as an MCP (Model Context Protocol) server. All 8 commands become tools that AI agents (Claude, etc.) can call directly.

### Start as MCP stdio server

```sh
w3stor --mcp
```

This launches a stdio-based MCP server. An agent connects via stdin/stdout and can invoke any command as a tool call.

### Register as MCP server

```sh
w3stor mcp add
```

Registers w3stor in your agent's MCP server config so it's auto-discovered.

### Generate skill files

```sh
w3stor skills add
```

Syncs skill markdown files to your agent's skill directory.

### Get LLM-readable manifest

```sh
# Summary manifest
w3stor --llms

# Full manifest with schemas
w3stor --llms-full
```

**Test MCP:**

```sh
# 1. Check the manifest
w3stor --llms
# Expected: machine-readable list of all commands with descriptions

# 2. Start MCP server (will block, waiting for stdin)
w3stor --mcp
# Expected: MCP protocol handshake over stdio

# 3. Register as MCP server
w3stor mcp add
# Expected: config file updated with w3stor entry
```

---

## Output Formatting

All commands support these global flags (provided by `incur`):

```sh
# JSON output
w3stor health --format json

# YAML output
w3stor files --format yaml

# Markdown table
w3stor files --format md

# Filter specific fields
w3stor files --filter-output "files[0].cid,files[0].status"

# Limit output tokens (for LLM context windows)
w3stor files --token-limit 500

# Get JSON Schema for any command
w3stor upload --schema
```

---

## x402 Payment Flow

Commands marked with "x402 payment" (`upload`, `attest`) work like this:

1. Client sends request to server
2. Server responds `402 Payment Required` with a challenge in headers
3. Client signs the challenge with your EVM private key (Base Sepolia)
4. Client retries the request with the payment proof header
5. Server verifies payment and processes the request

This is fully automatic — no manual approval needed. You just need USDC in your wallet on Base Sepolia.

---

## End-to-End Test

```sh
# 1. Build
bun run skills:build

# 2. Make sure server is running
w3stor health

# 3. Init wallet
w3stor init --privateKey $TEST_PRIVATE_KEY

# 4. Check wallet
w3stor wallet address
w3stor wallet balance

# 5. Upload a file
echo "test content" > /tmp/e2e-test.txt
w3stor upload /tmp/e2e-test.txt --tags "e2e,test"

# 6. List files (should show the upload)
w3stor files --search "e2e-test"

# 7. Check status (use CID from step 5)
w3stor status <cid-from-upload>

# 8. Get attestation (only works after SP replication)
w3stor attest <cid-from-upload>

# 9. Test MCP manifest
w3stor --llms
```

---

## Architecture

```
skills/
├── src/
│   ├── index.ts          # CLI entry point (incur framework)
│   ├── config.ts         # Local encrypted config (~/.config/w3stor/)
│   ├── client.ts         # Viem wallet/public clients for Base Sepolia
│   ├── fetch.ts          # Fetch wrapper with automatic x402 payment
│   └── commands/
│       ├── init.ts       # Wallet + server configuration
│       ├── health.ts     # Server health check
│       ├── upload.ts     # File upload (x402)
│       ├── files.ts      # List files with filtering
│       ├── status.ts     # Replication status
│       ├── attest.ts     # Storage attestation (x402)
│       └── wallet.ts     # Balance + address commands
└── w3stor/
    └── SKILL.md          # Skill manifest for agent discovery
```

| Component | Purpose |
|-----------|---------|
| `incur` | CLI framework with built-in MCP, skill sync, output formatting |
| `conf` | Encrypted local config storage |
| `viem` | EVM wallet/public clients (Base Sepolia) |
| `@x402/fetch` | Transparent micropayment wrapper around fetch |
| `@filoz/synapse-*` | Filecoin chain definitions |
