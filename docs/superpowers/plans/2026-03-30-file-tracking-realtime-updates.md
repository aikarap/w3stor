# File Tracking, Real-Time Updates & A2A Gateway Fix

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Filecoin tx hashes and x402 payment data in the DB, expose them through enriched API responses, deliver real-time file status updates via SSE, and fix the A2A gateway auth on VPS.

**Architecture:** Add `tx_hash` to `file_sp_status` and a new `payment_tx_hash`/`payment_network` to `user_files`. The worker already has `txHash` from `addPieces()` — pass it through to `updateSPStatus()`. The x402 middleware captures settlement tx from `processSettlement()` and persists it. Real-time updates use **SSE** (Server-Sent Events) over a Hono route — simpler than WebSocket for unidirectional server→client pushes, works with `Bun.serve()` natively, no Socket.IO dependency needed. The existing Redis pub/sub in workers stays; a new SSE endpoint subscribes to Redis channels and streams events to the frontend. The dead Socket.IO code gets removed.

**Tech Stack:** Drizzle ORM (migrations), Hono (SSE route), Redis pub/sub (existing), BullMQ (existing workers), React Query + EventSource (frontend), Bun runtime.

---

## File Structure

### Files to create
- `packages/db/drizzle/0001_add_tx_hashes.sql` — migration adding columns
- `apps/web/src/hooks/use-file-events.ts` — SSE hook for real-time file status
- `packages/api/src/routes/events.ts` — SSE endpoint for file status streaming

### Files to modify
- `packages/db/src/schema/files.ts` — add `txHash` to `fileSPStatus`, add `paymentTxHash`/`paymentNetwork` to `userFiles`
- `packages/db/src/queries/files.ts` — update `updateSPStatus()` to accept `txHash`, update `listUserFiles()` to return new columns, update `createUserFile()` to accept payment fields
- `packages/api/src/routes/files.ts` — return `piece_cid`, `tx_hash`, `payment_tx_hash`, `payment_network` in `/files` and `/status/:cid` responses
- `packages/api/src/routes/platform.ts` — return enriched file data in activity feed
- `packages/db/src/queries/platform.ts` — include `piece_cid` in `listAllFiles`
- `packages/workers/src/index.ts` — pass `txHash` to `updateSPStatus()`, include in Redis pub/sub payload
- `packages/api/src/middleware/x402.ts` — capture settlement tx hash and persist via `updateUserFilePayment()`
- `packages/api/src/routes/upload.ts` — return `payment_tx_hash` in response after settlement
- `packages/api/src/hono.ts` — register events route
- `packages/api/src/index.ts` — no changes needed (Bun.serve + Hono handles SSE natively)
- `apps/web/src/components/files/file-table.tsx` — add PDP explorer, Filecoin TX, IPFS, and payment TX link columns
- `apps/web/src/hooks/use-files.ts` — update `FileItem` interface, integrate SSE hook for auto-refresh
- `apps/web/src/hooks/use-platform.ts` — no changes needed (platform queries unchanged)
- `.env.prod.example` — add `AI_GATEWAY_API_KEY`
- `.env.example` — add `AI_GATEWAY_API_KEY`

### Files to delete
- `packages/api/src/websocket/index.ts` — dead Socket.IO setup
- `packages/api/src/websocket/chat-handler.ts` — dead Socket.IO chat handler
- `packages/api/src/websocket/file-status-bridge.ts` — replaced by SSE route

---

## Chunk 1: A2A Gateway Fix & Env Cleanup

### Task 1: Add AI_GATEWAY_API_KEY to env examples

**Files:**
- Modify: `.env.example:22-23`
- Modify: `.env.prod.example:21-22`

- [ ] **Step 1: Update `.env.example`**

Add `AI_GATEWAY_API_KEY` under the AI section:

```
# AI / LLM (all LLM calls go through AI SDK gateway)
AI_GATEWAY_API_KEY=
AI_DEFAULT_MODEL=openai/gpt-4o-mini
```

- [ ] **Step 2: Update `.env.prod.example`**

Same addition:

```
# === AI / LLM ===
AI_GATEWAY_API_KEY=
AI_DEFAULT_MODEL=openai/gpt-4o-mini
```

- [ ] **Step 3: Remove dead env vars documentation**

In the VPS `.env.prod`, `LLM_API_KEY` and `LLM_CHAT_MODEL` are unused — document in a comment that they should be replaced with `AI_GATEWAY_API_KEY`. (Actual VPS `.env.prod` is managed manually by the user.)

- [ ] **Step 4: Commit**

```bash
git add .env.example .env.prod.example
git commit -m "fix: add AI_GATEWAY_API_KEY to env examples for A2A gateway auth"
```

### Task 2: Remove dead Socket.IO code

**Files:**
- Delete: `packages/api/src/websocket/index.ts`
- Delete: `packages/api/src/websocket/chat-handler.ts`
- Delete: `packages/api/src/websocket/file-status-bridge.ts`
- Modify: `packages/api/package.json` — remove `socket.io` dependency

- [ ] **Step 1: Delete the websocket directory**

```bash
rm -rf packages/api/src/websocket/
```

- [ ] **Step 2: Remove socket.io from package.json**

In `packages/api/package.json`, remove `"socket.io": "^4"` from dependencies.

- [ ] **Step 3: Verify no remaining imports**

```bash
grep -r "socket.io\|websocket\|setupSocketIO\|setupChatNamespace\|file-status-bridge" packages/api/src/ --include="*.ts"
```

Expected: no results.

- [ ] **Step 4: Run typecheck**

```bash
cd packages/api && bun run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/
git commit -m "chore: remove dead Socket.IO code — replaced by SSE in next task"
```

---

## Chunk 2: DB Schema — Persist TX Hashes

### Task 3: Add tx_hash and payment columns to schema

**Files:**
- Modify: `packages/db/src/schema/files.ts`

- [ ] **Step 1: Add `txHash` to `fileSPStatus` table**

In `packages/db/src/schema/files.ts`, add after the `pieceCid` column in `fileSPStatus`:

```typescript
txHash: text("tx_hash"),
```

- [ ] **Step 2: Add payment columns to `userFiles` table**

In `packages/db/src/schema/files.ts`, add after `metadata` in `userFiles`:

```typescript
paymentTxHash: text("payment_tx_hash"),
paymentNetwork: text("payment_network"),
```

- [ ] **Step 3: Commit schema changes**

```bash
git add packages/db/src/schema/files.ts
git commit -m "feat: add tx_hash to file_sp_status, payment fields to user_files schema"
```

### Task 4: Generate and apply migration

**Files:**
- Create: `packages/db/drizzle/0001_add_tx_hashes.sql` (auto-generated by drizzle-kit)

- [ ] **Step 1: Generate migration**

```bash
cd packages/db && bunx drizzle-kit generate
```

This creates a new SQL migration file. Verify it contains:

```sql
ALTER TABLE "file_sp_status" ADD COLUMN "tx_hash" text;
ALTER TABLE "user_files" ADD COLUMN "payment_tx_hash" text;
ALTER TABLE "user_files" ADD COLUMN "payment_network" text;
```

- [ ] **Step 2: Review generated migration**

Read the generated file and confirm it only adds the 3 columns — no destructive changes.

- [ ] **Step 3: Apply migration locally**

```bash
cd packages/db && bun run src/migrate.ts
```

Expected: "Migrations complete"

- [ ] **Step 4: Commit**

```bash
git add packages/db/drizzle/
git commit -m "feat: migration — add tx_hash, payment_tx_hash, payment_network columns"
```

### Task 5: Update query functions to handle new columns

**Files:**
- Modify: `packages/db/src/queries/files.ts`

- [ ] **Step 1: Update `updateSPStatus` to accept `txHash`**

Add `txHash?: string` to the params type and include it in the insert/upsert:

```typescript
export async function updateSPStatus(params: {
	cid: string;
	spId: string;
	status: string;
	url?: string;
	verifiedAt?: Date;
	pieceCid?: string;
	txHash?: string;
}) {
	const db = getDatabase();
	await db
		.insert(fileSPStatus)
		.values({
			cid: params.cid,
			spId: params.spId,
			status: params.status,
			url: params.url ?? null,
			pieceCid: params.pieceCid ?? null,
			verifiedAt: params.verifiedAt ?? null,
			txHash: params.txHash ?? null,
		})
		.onConflictDoUpdate({
			target: [fileSPStatus.cid, fileSPStatus.spId],
			set: {
				status: params.status,
				url: sql`COALESCE(EXCLUDED.url, ${fileSPStatus.url})`,
				pieceCid: sql`COALESCE(EXCLUDED.piece_cid, ${fileSPStatus.pieceCid})`,
				verifiedAt: sql`COALESCE(EXCLUDED.verified_at, ${fileSPStatus.verifiedAt})`,
				txHash: sql`COALESCE(EXCLUDED.tx_hash, ${fileSPStatus.txHash})`,
				updatedAt: new Date(),
			},
		});
}
```

- [ ] **Step 2: Update `listUserFiles` query to return new columns**

In the SQL query, add `piece_cid`, `payment_tx_hash`, `payment_network` to the SELECT:

```typescript
const result = await db.execute(sql`
	SELECT f.*, uf.metadata as user_metadata, uf.filename as user_filename,
		uf.payment_tx_hash, uf.payment_network,
		(SELECT COUNT(*)::int FROM file_sp_status fsp WHERE fsp.cid = f.cid AND fsp.status IN ('stored', 'verified')) AS sp_count,
		COUNT(*) OVER() as total
	FROM user_files uf
	INNER JOIN files f ON f.cid = uf.cid
	WHERE ${whereClause}
	ORDER BY uf.created_at DESC
	LIMIT ${limit} OFFSET ${offset}
`);
```

Note: `f.*` already includes `piece_cid` from the `files` table. The new fields added are `uf.payment_tx_hash` and `uf.payment_network`.

- [ ] **Step 3: Add `updateUserFilePayment` function**

Add a new exported function at the end of the file:

```typescript
export async function updateUserFilePayment(params: {
	walletAddress: string;
	cid: string;
	paymentTxHash: string;
	paymentNetwork: string;
}) {
	const db = getDatabase();
	await db
		.update(userFiles)
		.set({
			paymentTxHash: params.paymentTxHash,
			paymentNetwork: params.paymentNetwork,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(userFiles.walletAddress, params.walletAddress),
				eq(userFiles.cid, params.cid),
			),
		);
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd packages/db && bun run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/files.ts
git commit -m "feat: updateSPStatus accepts txHash, listUserFiles returns payment fields"
```

---

## Chunk 3: Worker & Middleware — Persist TX Data

### Task 6: Worker passes txHash to updateSPStatus

**Files:**
- Modify: `packages/workers/src/index.ts:71-82`

- [ ] **Step 1: Pass txHash from upload results to updateSPStatus**

In `processFilecoinUpload`, the `succeeded` array items are `CarUploadResult` which already has `txHash`. Update the loop at line ~71:

```typescript
for (const result of succeeded) {
	const spId = result.configId || `sp-${result.provider.id}`;

	await updateSPStatus({
		cid,
		spId,
		status: "stored",
		url: result.provider.endpoint,
		verifiedAt: new Date(),
		pieceCid: result.pieceCid,
		txHash: result.txHash,
	});

	logger.info("SP upload completed", {
		jobId: job.id,
		cid,
		spId,
		pieceCid: result.pieceCid,
		txHash: result.txHash,
		providerId: result.provider.id,
		ipfsRootCid: result.ipfsRootCid,
	});
}
```

- [ ] **Step 2: Include txHash in Redis pub/sub payload**

Update the Redis publish payload (line ~139) to include per-SP tx hashes:

```typescript
await redis.publish(
	`file:${cid}:status`,
	JSON.stringify(
		{
			cid,
			status:
				confirmedSPs >= replicationTotalProviders
					? "fully_replicated"
					: confirmedSPs >= replicationMinProviders
						? "stored"
						: "partial",
			confirmedSPs,
			totalProviders,
			failedProviders: failed.map((f) => f.configId),
			providers: succeeded.map((r) => ({
				spId: r.configId || `sp-${r.provider.id}`,
				txHash: r.txHash,
				pieceCid: r.pieceCid,
			})),
		},
		(_, v) => (typeof v === "bigint" ? v.toString() : v),
	),
);
```

- [ ] **Step 3: Run typecheck**

```bash
cd packages/workers && bun run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/workers/src/index.ts
git commit -m "feat: worker persists txHash to file_sp_status and includes in pub/sub"
```

### Task 7: x402 middleware persists payment settlement tx

**Files:**
- Modify: `packages/api/src/middleware/x402.ts:179-198`
- Modify: `packages/api/src/routes/upload.ts`

- [ ] **Step 1: Add import for `updateUserFilePayment`**

At the top of `packages/api/src/middleware/x402.ts`:

```typescript
import { updateUserFilePayment } from "@w3stor/db";
```

- [ ] **Step 2: Capture and store settlement tx hash**

After settlement succeeds (line ~190), extract the tx hash and store it in Hono context for the route handler to use:

```typescript
if (settleResult.success) {
	for (const [key, value] of Object.entries(settleResult.headers)) {
		c.res.headers.set(key, String(value));
	}
	// Store settlement info in context for downstream use
	c.set("paymentTxHash" as never, (settleResult.transaction ?? "") as never);
	c.set("paymentNetwork" as never, "eip155:84532" as never);
	logger.info("x402: Payment settled", { transaction: settleResult.transaction });
}
```

- [ ] **Step 3: Update upload route to persist payment tx after response**

In `packages/api/src/routes/upload.ts`, after the successful upload response is built (before returning), persist the payment data. The payment settlement happens *after* the handler via middleware, so we need a different approach.

Instead, add a helper in the x402 middleware that persists payment data. After settlement, call `updateUserFilePayment`:

In `packages/api/src/middleware/x402.ts`, update the settlement block:

```typescript
if (settleResult.success) {
	for (const [key, value] of Object.entries(settleResult.headers)) {
		c.res.headers.set(key, String(value));
	}
	logger.info("x402: Payment settled", { transaction: settleResult.transaction });

	// Persist payment tx to user_files if this was an upload
	const payer = c.get("walletAddress" as never) as string | undefined;
	const txHash = settleResult.transaction as string | undefined;
	if (payer && txHash) {
		// Extract CID from response body (for upload routes)
		try {
			const clonedRes = c.res.clone();
			const body = await clonedRes.json() as { cid?: string };
			if (body.cid) {
				await updateUserFilePayment({
					walletAddress: payer,
					cid: body.cid,
					paymentTxHash: txHash,
					paymentNetwork: "eip155:84532",
				});
			}
		} catch {
			// Non-upload routes or parse failure — skip
		}
	}
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd packages/api && bun run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/middleware/x402.ts packages/api/src/routes/upload.ts
git commit -m "feat: x402 middleware persists payment settlement tx hash to user_files"
```

---

## Chunk 4: API — Enrich Responses & Add SSE Endpoint

### Task 8: Enrich /files and /status/:cid responses

**Files:**
- Modify: `packages/api/src/routes/files.ts`

- [ ] **Step 1: Update `/status/:cid` to return txHash per provider and piece_cid**

```typescript
filesRoute.get("/status/:cid", async (c) => {
	const cid = c.req.param("cid");
	const file = await findFileByCID(cid);
	if (!file) return c.json({ error: "File not found" }, 404);

	const spStatuses = await getSPStatuses(cid);
	return c.json({
		cid: file.cid,
		pieceCid: file.pieceCid,
		status: file.status,
		sizeBytes: file.sizeBytes,
		contentType: file.contentType,
		pinataPinned: file.pinataPinned,
		createdAt: file.createdAt,
		providers: spStatuses.map((sp: any) => ({
			spId: sp.spId,
			status: sp.status,
			url: sp.url,
			txHash: sp.txHash,
			pieceCid: sp.pieceCid,
			verifiedAt: sp.verifiedAt,
		})),
		verifiedSPs: spStatuses.filter(
			(sp: any) => sp.status === "verified" || sp.status === "stored",
		).length,
	});
});
```

- [ ] **Step 2: Verify `/files` already returns new columns**

The `listUserFiles` query update in Task 5 already includes `payment_tx_hash`, `payment_network`, and `piece_cid` (via `f.*`). No changes needed to the `/files` route handler since it passes through the query result directly.

- [ ] **Step 3: Run typecheck**

```bash
cd packages/api && bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/files.ts
git commit -m "feat: /status/:cid returns txHash per provider and piece_cid"
```

### Task 9: Enrich platform activity with piece_cid

**Files:**
- Modify: `packages/db/src/queries/platform.ts`

- [ ] **Step 1: Verify piece_cid is already in listAllFiles**

The `listAllFiles` query already selects `f.piece_cid` via `f.*` glob in the SELECT. No change needed. The activity feed response already includes it.

- [ ] **Step 2: Commit (skip if no changes)**

No commit needed if no changes were made.

### Task 10: Create SSE endpoint for real-time file status

**Files:**
- Create: `packages/api/src/routes/events.ts`
- Modify: `packages/api/src/hono.ts`

- [ ] **Step 1: Create SSE route**

Create `packages/api/src/routes/events.ts`:

```typescript
import { getWorkerRedisConnection } from "@w3stor/modules/queue";
import { logger } from "@w3stor/shared";
import { Hono } from "hono";

export const eventsRoute = new Hono();

/**
 * GET /events/files/:cid — SSE stream for a specific file's status updates.
 * Client connects with EventSource, receives real-time replication progress.
 */
eventsRoute.get("/events/files/:cid", async (c) => {
	const cid = c.req.param("cid");

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			function send(event: string, data: unknown) {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			}

			// Send initial keepalive
			send("connected", { cid });

			let subscriber: ReturnType<typeof getWorkerRedisConnection> | null = null;

			try {
				subscriber = getWorkerRedisConnection().duplicate();

				subscriber.subscribe(`file:${cid}:status`, (err) => {
					if (err) {
						logger.error("SSE: Failed to subscribe", { cid, error: err.message });
						controller.close();
						return;
					}
					logger.info("SSE: Subscribed to file status", { cid });
				});

				subscriber.on("message", (_channel: string, message: string) => {
					try {
						const data = JSON.parse(message);
						send("file-status", data);

						// Close stream on terminal states
						if (data.status === "fully_replicated" || data.status === "failed") {
							send("done", { status: data.status });
							subscriber?.unsubscribe();
							subscriber?.quit();
							controller.close();
						}
					} catch (error) {
						logger.error("SSE: Failed to parse message", { cid, error });
					}
				});
			} catch (error) {
				logger.error("SSE: Redis connection failed", { cid, error });
				controller.close();
			}

			// Cleanup on client disconnect
			c.req.raw.signal.addEventListener("abort", () => {
				subscriber?.unsubscribe();
				subscriber?.quit();
				logger.info("SSE: Client disconnected", { cid });
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
		},
	});
});

/**
 * GET /events/platform — SSE stream for platform-wide file events.
 * Used by the public platform metrics page.
 */
eventsRoute.get("/events/platform", async (c) => {
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			function send(event: string, data: unknown) {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			}

			send("connected", { ts: Date.now() });

			let subscriber: ReturnType<typeof getWorkerRedisConnection> | null = null;

			try {
				subscriber = getWorkerRedisConnection().duplicate();

				subscriber.psubscribe("file:*:status", (err) => {
					if (err) {
						logger.error("SSE: Platform subscribe failed", { error: err.message });
						controller.close();
						return;
					}
				});

				subscriber.on("pmessage", (_pattern: string, _channel: string, message: string) => {
					try {
						const data = JSON.parse(message);
						send("file-status", data);
					} catch (error) {
						logger.error("SSE: Platform parse failed", { error });
					}
				});
			} catch (error) {
				logger.error("SSE: Platform Redis connection failed", { error });
				controller.close();
			}

			c.req.raw.signal.addEventListener("abort", () => {
				subscriber?.punsubscribe();
				subscriber?.quit();
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
		},
	});
});
```

- [ ] **Step 2: Register events route in hono.ts**

In `packages/api/src/hono.ts`, add:

```typescript
import { eventsRoute } from "./routes/events";
```

And after the other route registrations:

```typescript
// SSE real-time events
app.route("/", eventsRoute);
```

- [ ] **Step 3: Run typecheck**

```bash
cd packages/api && bun run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/events.ts packages/api/src/hono.ts
git commit -m "feat: SSE endpoints for real-time file status and platform events"
```

---

## Chunk 5: Frontend — Enhanced File Table with Explorer Links

### Task 11: Create SSE hook for file events

**Files:**
- Create: `apps/web/src/hooks/use-file-events.ts`

- [ ] **Step 1: Create the SSE hook**

```typescript
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { API_URL } from "@/lib/constants";

/**
 * Subscribe to SSE events for a specific file's replication status.
 * Automatically invalidates React Query cache when updates arrive.
 */
export function useFileStatusEvents(cid: string | null, walletAddress: string | undefined) {
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!cid) return;

		const eventSource = new EventSource(`${API_URL}/events/files/${cid}`);

		eventSource.addEventListener("file-status", () => {
			// Invalidate both the specific file status and the file list
			queryClient.invalidateQueries({ queryKey: queryKeys.files.status(cid) });
			if (walletAddress) {
				queryClient.invalidateQueries({ queryKey: queryKeys.files.all(walletAddress) });
			}
		});

		eventSource.addEventListener("done", () => {
			eventSource.close();
		});

		eventSource.onerror = () => {
			eventSource.close();
		};

		return () => {
			eventSource.close();
		};
	}, [cid, walletAddress, queryClient]);
}

/**
 * Subscribe to platform-wide file events.
 * Invalidates platform queries when any file status changes.
 */
export function usePlatformEvents() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const eventSource = new EventSource(`${API_URL}/events/platform`);

		eventSource.addEventListener("file-status", () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.platform.activity() });
			queryClient.invalidateQueries({ queryKey: queryKeys.platform.stats() });
			queryClient.invalidateQueries({ queryKey: queryKeys.platform.metrics() });
		});

		eventSource.onerror = () => {
			// Reconnect after 5s on error
			eventSource.close();
		};

		return () => {
			eventSource.close();
		};
	}, [queryClient]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-file-events.ts
git commit -m "feat: SSE hooks for real-time file status and platform events"
```

### Task 12: Update FileTable with explorer links

**Files:**
- Modify: `apps/web/src/components/files/file-table.tsx`

- [ ] **Step 1: Update FileRow interface**

```typescript
interface FileRow {
	cid: string;
	user_filename?: string;
	filename?: string;
	size_bytes?: number;
	size?: number;
	status: string;
	sp_count?: number;
	piece_cid?: string;
	payment_tx_hash?: string;
	payment_network?: string;
	created_at?: string;
	createdAt?: string;
}
```

- [ ] **Step 2: Add explorer URL helper functions**

Add after the existing helper functions:

```typescript
function getPdpExplorerUrl(pieceCid: string): string {
	return `https://pdp.vxb.ai/calibration/piece/${pieceCid}`;
}

function getIpfsUrl(cid: string): string {
	return `https://ipfs.io/ipfs/${cid}`;
}

function getPaymentExplorerUrl(txHash: string, network?: string): string {
	// Default to Base Sepolia, extensible for future networks
	switch (network) {
		case "eip155:84532":
		default:
			return `https://sepolia.basescan.org/tx/${txHash}`;
	}
}

function getNetworkLabel(network?: string): string {
	switch (network) {
		case "eip155:84532":
			return "Base Sepolia";
		default:
			return network ?? "Unknown";
	}
}
```

- [ ] **Step 3: Replace the table body with enriched columns**

Replace the full table JSX (the `<Table>` component) with:

```tsx
<Table>
	<TableHeader>
		<TableRow>
			<TableHead>
				<button type="button" onClick={() => toggleSort("name")} className="flex items-center hover:text-foreground transition-colors">
					Name <SortIcon active={sortKey === "name"} dir={sortDir} />
				</button>
			</TableHead>
			<TableHead>CID</TableHead>
			<TableHead>
				<button type="button" onClick={() => toggleSort("size")} className="flex items-center hover:text-foreground transition-colors">
					Size <SortIcon active={sortKey === "size"} dir={sortDir} />
				</button>
			</TableHead>
			<TableHead>
				<button type="button" onClick={() => toggleSort("status")} className="flex items-center hover:text-foreground transition-colors">
					Status <SortIcon active={sortKey === "status"} dir={sortDir} />
				</button>
			</TableHead>
			<TableHead>
				<button type="button" onClick={() => toggleSort("sp_count")} className="flex items-center hover:text-foreground transition-colors">
					SPs <SortIcon active={sortKey === "sp_count"} dir={sortDir} />
				</button>
			</TableHead>
			<TableHead>
				<button type="button" onClick={() => toggleSort("date")} className="flex items-center hover:text-foreground transition-colors">
					Date <SortIcon active={sortKey === "date"} dir={sortDir} />
				</button>
			</TableHead>
			<TableHead>Links</TableHead>
		</TableRow>
	</TableHeader>
	<TableBody>
		{sorted.map((file) => (
			<TableRow key={file.cid}>
				<TableCell className="font-medium max-w-[200px] truncate">{getName(file)}</TableCell>
				<TableCell>
					<button
						type="button"
						onClick={() => copyCid(file.cid)}
						className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
					>
						{file.cid.slice(0, 12)}...
						<Copy className="h-3 w-3" />
					</button>
				</TableCell>
				<TableCell className="text-muted-foreground">
					{formatSize(getSize(file))}
				</TableCell>
				<TableCell>
					<StatusBadge status={file.status} />
				</TableCell>
				<TableCell className="text-muted-foreground">{file.sp_count ?? 0}</TableCell>
				<TableCell className="text-muted-foreground text-xs">
					{new Date(getDate(file)).toLocaleDateString()}
				</TableCell>
				<TableCell>
					<div className="flex items-center gap-1">
						<a
							href={getIpfsUrl(file.cid)}
							target="_blank"
							rel="noopener noreferrer"
							title="View on IPFS"
						>
							<Button variant="ghost" size="sm">
								<Download className="h-4 w-4" />
							</Button>
						</a>
						{file.piece_cid && (
							<a
								href={getPdpExplorerUrl(file.piece_cid)}
								target="_blank"
								rel="noopener noreferrer"
								title="PDP Explorer"
							>
								<Button variant="ghost" size="sm" className="text-xs font-mono">
									PDP
								</Button>
							</a>
						)}
						{file.payment_tx_hash && (
							<a
								href={getPaymentExplorerUrl(file.payment_tx_hash, file.payment_network)}
								target="_blank"
								rel="noopener noreferrer"
								title={`Payment on ${getNetworkLabel(file.payment_network)}`}
							>
								<Button variant="ghost" size="sm" className="text-xs font-mono">
									Pay
								</Button>
							</a>
						)}
					</div>
				</TableCell>
			</TableRow>
		))}
		{files.length === 0 && (
			<TableRow>
				<TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
					No files uploaded yet
				</TableCell>
			</TableRow>
		)}
	</TableBody>
</Table>
```

- [ ] **Step 4: Update the `use-files.ts` FileItem interface**

In `apps/web/src/hooks/use-files.ts`, update the interface:

```typescript
interface FileItem {
	cid: string;
	filename: string;
	size: number;
	status: string;
	sp_count?: number;
	piece_cid?: string;
	payment_tx_hash?: string;
	payment_network?: string;
	created_at: string;
	tags?: string;
	description?: string;
}
```

- [ ] **Step 5: Run frontend typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/files/file-table.tsx apps/web/src/hooks/use-files.ts
git commit -m "feat: file table with PDP explorer, IPFS, and payment TX links"
```

### Task 13: Wire SSE into dashboard pages

**Files:**
- Modify: `apps/web/src/app/dashboard/files/page.tsx`
- Modify: `apps/web/src/app/platform/page.tsx`

- [ ] **Step 1: Add SSE to files page**

In `apps/web/src/app/dashboard/files/page.tsx`, the simplest integration is to replace the 10s polling in `useFileStatus` with SSE-driven cache invalidation. Since the file list itself already uses React Query with `staleTime: 15_000`, we just need the SSE to trigger invalidation.

Add to the files page component, after the existing hooks:

```typescript
import { usePlatformEvents } from "@/hooks/use-file-events";

// Inside the component:
usePlatformEvents(); // Auto-refreshes file list when any file status changes
```

This is a lightweight approach — the SSE connection on the files page listens to platform-wide events and invalidates the query cache, causing the file list to refetch.

- [ ] **Step 2: Add SSE to platform page**

In `apps/web/src/app/platform/page.tsx`, add:

```typescript
import { usePlatformEvents } from "@/hooks/use-file-events";

// Inside PlatformPage component, after existing hooks:
usePlatformEvents();
```

- [ ] **Step 3: Remove polling fallback from useFileStatus**

In `apps/web/src/hooks/use-files.ts`, update `useFileStatus` to reduce polling interval since SSE handles real-time. Change `refetchInterval` from `10_000` to `30_000` as a fallback-only mechanism:

```typescript
refetchInterval: (query) => {
	const status = query.state.data?.status;
	if (status === "fully_replicated" || status === "failed") return false;
	return 30_000; // Fallback only — SSE handles real-time updates
},
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/files/page.tsx apps/web/src/app/platform/page.tsx apps/web/src/hooks/use-files.ts
git commit -m "feat: wire SSE real-time events into dashboard and platform pages"
```

---

## Chunk 6: Verification & Cleanup

### Task 14: End-to-end verification

- [ ] **Step 1: Verify DB migration is applied**

```bash
cd packages/db && bun run src/migrate.ts
```

- [ ] **Step 2: Verify API typechecks**

```bash
cd packages/api && bun run typecheck
```

- [ ] **Step 3: Verify workers typecheck**

```bash
cd packages/workers && bun run typecheck
```

- [ ] **Step 4: Verify frontend typechecks**

```bash
cd apps/web && bun run typecheck
```

- [ ] **Step 5: Start local dev and test SSE endpoint**

```bash
# In separate terminals:
# 1. docker-compose up (postgres + redis)
# 2. bun run --filter @w3stor/api dev
# 3. curl -N http://localhost:4000/events/platform
```

Expected: SSE stream with `event: connected` message.

- [ ] **Step 6: Verify /status/:cid returns new fields**

```bash
curl http://localhost:4000/status/<any-existing-cid> | jq '.providers[0].txHash, .pieceCid'
```

Expected: `txHash` and `pieceCid` fields present (null for old records, populated for new uploads).

### Task 15: VPS deployment notes

This is not code — it's a checklist for the user to execute on the VPS:

- [ ] **Step 1: Add `AI_GATEWAY_API_KEY` to VPS `/opt/w3stor/.env.prod`**

```
AI_GATEWAY_API_KEY=<your-vercel-ai-gateway-key>
```

- [ ] **Step 2: Remove dead env vars from VPS `.env.prod`**

Remove `LLM_API_KEY` and `LLM_CHAT_MODEL` — they are unused.

- [ ] **Step 3: Deploy and run migration**

```bash
cd /opt/w3stor
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml up -d api workers
```

- [ ] **Step 4: Verify A2A gateway works**

```bash
curl -X POST https://api.w3stor.xyz/a2a/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"text","text":"hello"}],"messageId":"test-1"},"configuration":{"acceptedOutputModes":["text"]}},"id":"1"}'
```

Expected: A valid JSON-RPC response (not a 401 gateway error).
