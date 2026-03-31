---
name: w3stor
description: CLI for W3Stor — persistent decentralized agent memory and storage on Filecoin with x402 micropayments. Upload files, build agent memory graphs, semantic search, check replication, get attestations, and manage your wallet.
---

# w3stor

Persistent agent memory and decentralized storage CLI. Files are pinned to IPFS (Pinata) immediately, then replicated across multiple Filecoin Storage Providers. Each agent gets a sovereign knowledge graph with semantic search across stored files. Payments are handled automatically via the x402 protocol using USDC on Base Sepolia.

## Quick Start

```sh
# 1. Install globally
npm install -g @w3stor/cli

# 2. Initialize your wallet
w3stor init --privateKey 0x<your-private-key>

# 3. Verify everything works
w3stor health
w3stor wallet balance
```

### Alternative init methods

```sh
# From PRIVATE_KEY env var
PRIVATE_KEY=0x... w3stor init --auto

# From a Foundry cast keystore
w3stor init --keystore ~/.foundry/keystores/default
```

The CLI always connects to `https://api.w3stor.xyz` — no server URL configuration needed.

## File Size Limits

| Limit | Value | Notes |
|-------|-------|-------|
| **Minimum** | 127 bytes | PieceCIDv2 calculation requires at least 127 bytes payload |
| **Maximum** | ~1 GiB (1,065,353,216 bytes) | 1 GiB * 127/128 — Filecoin sector alignment |
| **Batch max** | 10 files, 0.4 GiB per file | Per batch upload request |

## Pricing

All paid operations use x402 micropayments (USDC on Base Sepolia). No accounts or API keys needed — just a funded wallet.

| Operation | Price | Unit |
|-----------|-------|------|
| Upload | $0.0001 | per MB (min $0.00001) |
| Attestation | $0.50 | per operation |
| Workflow execute | $0.001 | per operation |
| Graph: add file | $0.00005 | per operation |
| Graph: connect | $0.00002 | per operation |
| Batch upload | $0.0002/file + $0.0001/MB + $0.00005/connection | combined |

## Commands

| Command | Description | Costs USDC |
|---------|-------------|:----------:|
| `w3stor init` | Configure wallet and server connection | No |
| `w3stor health` | Check server + service health | No |
| `w3stor upload <file>` | Upload a file to IPFS + Filecoin | Yes |
| `w3stor batch <files>` | Batch upload with graph connections | Yes |
| `w3stor files` | List uploaded files | No |
| `w3stor status <cid>` | Check replication across SPs | No |
| `w3stor attest <cid>` | Get cryptographic storage attestation | Yes |
| `w3stor auth login` | SIWE session auth (required for graph reads) | No |
| `w3stor graph add <cid>` | Add file to agent memory graph | Yes |
| `w3stor graph connect <from> <to>` | Create file relationship | Yes |
| `w3stor graph search <query>` | Semantic search across your files | No |
| `w3stor graph traverse <cid>` | Explore connected files by hops | No |
| `w3stor graph remove <cid>` | Remove file from memory graph | No |
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

### Agent Memory (Knowledge Graph)

```sh
# First authenticate for graph read operations
w3stor auth login

# Add a file to your memory graph with metadata
w3stor graph add bafkrei... --description "Q3 financial report" --tags "finance,quarterly"

# Connect files with relationships
w3stor graph connect bafkreiA bafkreiB --rel "references"
w3stor graph connect bafkreiB bafkreiC --rel "derived_from"

# Semantic search — finds files by meaning, not just keywords
w3stor graph search "quarterly financial analysis"
w3stor graph search "machine learning datasets" --limit 10

# Traverse the graph from a starting file
w3stor graph traverse bafkrei... --depth 3

# Remove a file from memory (does not delete the stored file)
w3stor graph remove bafkrei...
```

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

## Workflows

### Upload + Build Memory in One Flow

```sh
# 1. Upload files
w3stor upload research.pdf --tags "research,ml"
# Returns CID: bafkreiA

w3stor upload dataset.csv --tags "data,ml"
# Returns CID: bafkreiB

# 2. Add to memory graph with descriptions
w3stor graph add bafkreiA --description "ML research paper on transformers" --tags "research,ml"
w3stor graph add bafkreiB --description "Training dataset for transformer model" --tags "data,ml"

# 3. Connect them
w3stor graph connect bafkreiA bafkreiB --rel "trained_on"

# 4. Later, find related files by meaning
w3stor graph search "transformer training data"
```

### Batch Upload

Upload multiple files with graph connections in a single x402 payment. Supports up to 10 files (0.4 GiB each) with up to 50 connections per batch. Files can reference each other by index or existing CIDs.

```sh
# Upload two files with metadata and connections
w3stor batch "file1.csv,file2.csv" --metadata '{
  "files": [
    {
      "index": 0,
      "description": "First dataset",
      "tags": ["data", "ml"],
      "connections": [{"toIndex": 1, "relationship": "related_to"}]
    },
    {
      "index": 1,
      "description": "Second dataset",
      "tags": ["data", "ml"],
      "connections": [{"toCid": "bafkrei...", "relationship": "derived_from"}]
    }
  ]
}'
```

### Research Swarm Workflow

```sh
# Fan out research, store results, build a connected memory
w3stor upload paper1.pdf --tags "research"
w3stor upload paper2.pdf --tags "research"
w3stor upload synthesis.md --tags "synthesis"

w3stor graph connect bafkreiSynthesis bafkreiPaper1 --rel "synthesizes"
w3stor graph connect bafkreiSynthesis bafkreiPaper2 --rel "synthesizes"

# Traverse from synthesis to find all source material
w3stor graph traverse bafkreiSynthesis --depth 2
```

## Requirements

- Node.js 18+ or [Bun](https://bun.sh) runtime
- USDC on Base Sepolia for `upload`, `batch`, `attest`, `graph add`, and `graph connect` commands
- The CLI connects to the hosted API at `https://api.w3stor.xyz` — no local server setup needed
