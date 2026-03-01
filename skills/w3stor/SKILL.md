---
name: w3stor
description: CLI for Web3 Storage Agent — decentralized file storage on Filecoin with x402 micropayments. Upload files, check replication status, get storage attestations, and manage your wallet.
---

# w3stor

Decentralized storage CLI powered by Web3 Storage Agent. Files are pinned to IPFS (Pinata) immediately, then replicated across multiple Filecoin Storage Providers. Payments are handled automatically via the x402 protocol using USDC on Base Sepolia.

## Quick Start

```sh
# 1. Install dependencies
bun install

# 2. Build the CLI
bun run skills:build

# 3. Link globally (makes `w3stor` available in your terminal)
bun link

# 4. Start the server (in a separate terminal)
bun run dev

# 5. Initialize your wallet
w3stor init --privateKey 0x<your-private-key>

# 6. Verify everything works
w3stor health
w3stor wallet balance
```

> If you skip `bun link`, use `./dist/skills/index.js` instead of `w3stor`.

### Alternative init methods

```sh
# From PRIVATE_KEY env var
PRIVATE_KEY=0x... w3stor init --auto

# From a Foundry cast keystore
w3stor init --keystore ~/.foundry/keystores/default

# Custom server URL (default: http://localhost:4000)
w3stor init --serverUrl https://my-agent.example.com
```

## Commands

| Command | Description | Costs USDC |
|---------|-------------|:----------:|
| `w3stor init` | Configure wallet and server connection | No |
| `w3stor health` | Check server + service health | No |
| `w3stor upload <file>` | Upload a file to IPFS + Filecoin | Yes |
| `w3stor files` | List uploaded files | No |
| `w3stor status <cid>` | Check replication across SPs | No |
| `w3stor attest <cid>` | Get cryptographic storage attestation | Yes |
| `w3stor wallet balance` | Check USDC balance (Base Sepolia) | No |
| `w3stor wallet address` | Show configured wallet address | No |

## Usage

### Upload

```sh
w3stor upload photo.jpg
w3stor upload data.csv --tags "dataset,public"
w3stor upload report.pdf --metadata '{"project":"alpha"}'
w3stor upload doc.txt --tags "docs" --metadata '{"version":"2"}'
```

### List files

```sh
w3stor files
w3stor files --status stored
w3stor files --status fully_replicated
w3stor files --search "report"
w3stor files --tags "dataset"
w3stor files --page 2 --limit 5
```

Status values: `pinata_pinned`, `uploading`, `stored`, `fully_replicated`, `failed`

### Check status & attest

```sh
w3stor status bafkrei...
w3stor attest bafkrei...
```

### Wallet

```sh
w3stor wallet balance
w3stor wallet balance --wallet 0x...
w3stor wallet address
```

## Agent Integration (MCP)

The CLI doubles as an MCP server — all commands become tools for AI agents.

```sh
# Start as MCP stdio server
w3stor --mcp

# Register as MCP server in your agent config
w3stor mcp add

# Sync skill files to your agent
w3stor skills add

# Get machine-readable manifest (for LLMs)
w3stor --llms
w3stor --llms-full
```

## Output Formatting

All commands support these flags:

```sh
w3stor health --format json
w3stor files --format yaml
w3stor files --format md
w3stor files --filter-output "files[0].cid,files[0].status"
w3stor upload --schema
w3stor files --token-limit 500
```

## How x402 Payments Work

Commands that cost USDC (`upload`, `attest`) use the x402 protocol:

1. Client sends request to server
2. Server responds `402 Payment Required` with a challenge
3. Client auto-signs the challenge with your wallet key
4. Client retries with payment proof
5. Server verifies and processes

No manual approval needed — just have USDC on Base Sepolia.

## Requirements

- [Bun](https://bun.sh) runtime
- Running server (`bun run dev`) with PostgreSQL, Redis, and Pinata configured
- USDC on Base Sepolia for `upload` and `attest` commands
