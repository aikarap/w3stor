# Filecoin Integration

**Status**: ✅ Implemented (using @filoz/synapse-core)

## Overview

This service provides Filecoin storage integration using the synapse-core SDK. It handles:
- File uploads to Filecoin Storage Providers (SPs)
- Data retrieval and verification
- Dataset management
- Provider selection and health monitoring

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Filecoin Service Layer                                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │   Upload    │  │   Download   │  │    Verify      │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│         │                │                    │          │
│         └────────────────┴────────────────────┘          │
│                          │                               │
│                 ┌────────▼────────┐                      │
│                 │ Provider Manager │                      │
│                 └────────┬────────┘                      │
│                          │                               │
│                 ┌────────▼────────┐                      │
│                 │  Wallet Client  │                      │
│                 └────────┬────────┘                      │
└──────────────────────────┼──────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │  @filoz/synapse-core│
                │  - SP primitives    │
                │  - Piece CID calc   │
                │  - Dataset mgmt     │
                └──────────┬──────────┘
                           │
                ┌──────────▼──────────┐
                │  Filecoin Network   │
                │  - Storage Providers│
                │  - Smart Contracts  │
                │  - Payment Rails    │
                └─────────────────────┘
```

## Files

```
src/services/filecoin/
├── client.ts              # Wallet client initialization
├── upload.ts              # Upload files to Filecoin SPs
├── download.ts            # Download and verify files
├── verify.ts              # Verify file existence and integrity
├── dataset-manager.ts     # Manage datasets and pieces
├── provider-manager.ts    # SP selection and health checks
├── types.ts               # TypeScript type definitions
├── index.ts               # Public API exports
└── README.md              # This file
```

## Quick Start

### 1. Environment Setup

```bash
# Required environment variables
FILECOIN_PRIVATE_KEY=0x...
FILECOIN_RPC_URL=https://api.calibration.node.glif.io/rpc/v1
```

### 2. Basic Upload

```typescript
import { getClientFromEnv, uploadToFilecoin } from './services/filecoin'

const client = getClientFromEnv()
const fileData = new Uint8Array([/* your data */])

const result = await uploadToFilecoin(client, fileData, {
  metadata: { name: 'example.txt', type: 'text/plain' },
  onProgress: (stage, details) => {
    console.log(`Upload stage: ${stage}`, details)
  },
})

console.log('Uploaded:', result.pieceCid)
console.log('Dataset ID:', result.dataSetId)
```

### 3. Download & Verify

```typescript
import { downloadFromFilecoin, verifyFilecoinFile } from './services/filecoin'

const data = await downloadFromFilecoin(result.pieceCid, {
  providerEndpoint: result.provider.endpoint,
  verify: true,
})

const verification = await verifyFilecoinFile(
  result.pieceCid,
  result.provider.endpoint,
  result.provider.address
)

console.log('Verified:', verification.verified)
```

## Upload Flow

1. **Provider Selection**: Auto-select healthy SP or use specific provider
2. **Calculate PieceCID**: Compute Filecoin piece CID from data
3. **Upload to SP**: Send data to storage provider
4. **Wait for Parking**: Poll until piece is available
5. **Create Dataset**: Create on-chain dataset if needed
6. **Add Pieces**: Add piece to dataset via smart contract
7. **Wait for Confirmation**: Poll for transaction confirmation

## Provider Management

Storage providers are automatically selected based on:
- Health checks (ping endpoint)
- Provider registry on Filecoin
- Manual provider ID specification (optional)

```typescript
import { getAvailableProviders, selectProvider } from './services/filecoin'

const providers = await getAvailableProviders(client)
const selected = await selectProvider(client) // Auto-select healthy provider
```

## Dataset Management

Datasets are on-chain collections of pieces. Benefits:
- Grouped storage management
- Batch operations
- Unified payment tracking
- Proof-of-data-possession (PDP) verification

```typescript
import { getDataSet, listDataSetPieces } from './services/filecoin'

const dataset = await getDataSet(dataSetId, providerEndpoint)
const pieces = await listDataSetPieces(dataSetId, providerEndpoint)
```

## Size Limits

- **Minimum**: 127 bytes
- **Maximum**: ~254 MiB per piece
- For larger files, implement chunking (future enhancement)

## Payment Model

Filecoin uses on-chain payment rails:
- Deposit USDC into payment contract
- Automatic per-epoch deductions
- Monitor allowances and top up as needed

## Error Handling

All functions throw descriptive errors:
- `uploadToFilecoin`: Upload failures, provider issues
- `downloadFromFilecoin`: Download failures, verification errors
- `verifyFilecoinFile`: Network errors, CID mismatches

## Testing

```bash
# Run Filecoin integration tests
bun test src/services/filecoin/

# Test against calibration testnet
FILECOIN_PRIVATE_KEY=0x... bun run src/services/filecoin/test.ts
```

## Production Checklist

- [ ] Configure mainnet RPC endpoint
- [ ] Fund wallet with FIL for gas
- [ ] Deposit USDC into payment rails
- [ ] Set up provider allowlist (optional)
- [ ] Configure monitoring and alerts
- [ ] Implement retry logic in queue workers
- [ ] Set up piece verification cron jobs

## References

- [Synapse Core Docs](https://synapse.filecoin.services/)
- [Filecoin Docs](https://docs.filecoin.io/)
- [PDP Specification](https://github.com/filecoin-project/FIPs/blob/master/FIPS/fip-0000.md)
