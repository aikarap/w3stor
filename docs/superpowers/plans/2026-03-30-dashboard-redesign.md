# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate dashboard into tabbed layout (Files/Chat/Workflows), replace upload route with modal, add expandable real-time file rows, create public Agent Activity page, and simplify nav.

**Architecture:** The dashboard page becomes a single tabbed container. Chat and Workflows tabs lazily render the existing page components. The Files tab combines metrics cards + upload button + enhanced file table with expandable per-SP rows. Upload is a dialog modal. The Agent Activity page replaces Platform with a public file table (PieceCID/CID columns) and upload volume chart in tabs. SSE hooks drive real-time updates.

**Tech Stack:** Next.js App Router, shadcn/ui (Tabs, Dialog), React Query, SSE (EventSource), wagmi/x402

---

## File Structure

### Files to create
- `apps/web/src/components/files/upload-modal.tsx` — dialog with upload form, payment flow, pinning status
- `apps/web/src/components/files/expandable-file-row.tsx` — toggleable row showing per-SP status with real-time SSE
- `apps/web/src/components/files/sp-status-row.tsx` — single SP provider status display
- `apps/web/src/app/agent-activity/page.tsx` — public agent activity page with tabs
- `apps/web/src/app/agent-activity/layout.tsx` — metadata for agent activity

### Files to modify
- `apps/web/src/app/dashboard/page.tsx` — rewrite as tabbed layout (Files/Chat/Workflows)
- `apps/web/src/app/dashboard/layout.tsx` — no change needed (already minimal)
- `apps/web/src/components/files/file-table.tsx` — add expandable row toggle, accept `variant` prop for agent-activity mode
- `apps/web/src/components/layout/site-header.tsx` — update nav links
- `apps/web/src/hooks/use-files.ts` — add `useFileProviders` hook for per-SP status

### Files to delete
- `apps/web/src/app/dashboard/upload/page.tsx` — replaced by upload modal
- `apps/web/src/app/dashboard/files/page.tsx` — merged into dashboard Files tab
- `apps/web/src/app/dashboard/chat/page.tsx` — content moved (keep as redirect or inline)
- `apps/web/src/app/platform/page.tsx` — replaced by agent-activity
- `apps/web/src/app/platform/layout.tsx` — replaced by agent-activity
- `apps/web/src/app/swarm/page.tsx` — content moved to dashboard Workflows tab
- `apps/web/src/app/swarm/layout.tsx` — no longer needed

### Files to keep (re-exported as tab content)
- `apps/web/src/app/dashboard/chat/page.tsx` → extracted as component import
- `apps/web/src/app/swarm/page.tsx` → extracted as component import

---

## Chunk 1: Nav & Route Structure

### Task 1: Update landing page nav and dashboard nav

**Files:**
- Modify: `apps/web/src/components/layout/site-header.tsx`

- [ ] **Step 1: Update publicLinks array**

Replace:
```typescript
const publicLinks = [
	{ href: "/docs", label: "Docs" },
	{ href: "/swarm", label: "Live Demo" },
	{ href: "/platform", label: "Platform" },
];
```

With:
```typescript
const publicLinks = [
	{ href: "/docs", label: "Docs" },
	{ href: "/dashboard", label: "Dashboard" },
	{ href: "/agent-activity", label: "Agent Activity" },
];
```

- [ ] **Step 2: Remove dashboardLinks array and sub-nav**

Replace:
```typescript
const dashboardLinks = [
	{ href: "/dashboard", label: "Overview" },
	{ href: "/dashboard/upload", label: "Upload" },
	{ href: "/dashboard/files", label: "Files" },
	{ href: "/dashboard/chat", label: "Chat" },
];
```

With:
```typescript
const dashboardLinks = [
	{ href: "/dashboard", label: "Dashboard" },
];
```

- [ ] **Step 3: Remove the duplicate "Dashboard" button in the header**

In the header JSX, there's a conditional `{!isDashboard && (...)}` block that shows a "Dashboard" button. Since "Dashboard" is now in the main nav, remove this block entirely.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/site-header.tsx
git commit -m "feat: update nav — Docs, Dashboard, Agent Activity"
```

### Task 2: Create Agent Activity route scaffolding

**Files:**
- Create: `apps/web/src/app/agent-activity/layout.tsx`
- Create: `apps/web/src/app/agent-activity/page.tsx` (placeholder)

- [ ] **Step 1: Create layout**

```typescript
import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
	title: "Agent Activity | W3S Agent",
	description: "Public view of storage agent activity on Filecoin.",
};

export default function AgentActivityLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen">
			<SiteHeader />
			<main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
			<SiteFooter />
		</div>
	);
}
```

- [ ] **Step 2: Create placeholder page**

```typescript
"use client";

export default function AgentActivityPage() {
	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Agent Activity</h1>
			<p className="text-muted-foreground">Coming soon — public agent activity table.</p>
		</div>
	);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/agent-activity/
git commit -m "feat: scaffold agent-activity route"
```

---

## Chunk 2: Expandable File Rows & SP Status

### Task 3: Add useFileProviders hook

**Files:**
- Modify: `apps/web/src/hooks/use-files.ts`

- [ ] **Step 1: Add useFileProviders hook**

Add this new hook after the existing `useFileStatus` function:

```typescript
export function useFileProviders(cid: string | null) {
	return useQuery({
		queryKey: queryKeys.files.detail(cid ?? ""),
		queryFn: () => apiFetch<{
			cid: string;
			pieceCid: string | null;
			status: string;
			providers: Array<{
				spId: string;
				status: string;
				url: string | null;
				txHash: string | null;
				pieceCid: string | null;
				verifiedAt: string | null;
			}>;
		}>(`/status/${cid}`),
		enabled: !!cid,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (status === "fully_replicated" || status === "failed") return false;
			return 5_000;
		},
	});
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-files.ts
git commit -m "feat: add useFileProviders hook for per-SP status"
```

### Task 4: Create SP status row component

**Files:**
- Create: `apps/web/src/components/files/sp-status-row.tsx`

- [ ] **Step 1: Create component**

```typescript
"use client";

import { ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";

interface SPStatusRowProps {
	spId: string;
	status: string;
	txHash: string | null;
	pieceCid: string | null;
	verifiedAt: string | null;
}

function getFilecoinTxUrl(txHash: string): string {
	return `https://filecoin-testnet.blockscout.com/tx/${txHash}`;
}

function getPdpUrl(pieceCid: string): string {
	return `https://pdp.vxb.ai/calibration/piece/${pieceCid}`;
}

export function SPStatusRow({ spId, status, txHash, pieceCid, verifiedAt }: SPStatusRowProps) {
	return (
		<div className="flex items-center gap-4 py-2 px-4 text-sm">
			<span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{spId}</span>
			<StatusBadge status={status} />
			{txHash ? (
				<a
					href={getFilecoinTxUrl(txHash)}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 font-mono text-xs text-blue-400 hover:text-blue-300"
				>
					{txHash.slice(0, 10)}...{txHash.slice(-6)}
					<ExternalLink className="h-3 w-3" />
				</a>
			) : (
				<span className="text-xs text-muted-foreground">—</span>
			)}
			{pieceCid && (
				<a
					href={getPdpUrl(pieceCid)}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
				>
					PDP
					<ExternalLink className="h-3 w-3" />
				</a>
			)}
			{verifiedAt && (
				<span className="text-xs text-muted-foreground ml-auto">
					{new Date(verifiedAt).toLocaleString()}
				</span>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/files/sp-status-row.tsx
git commit -m "feat: SP status row component with tx/PDP links"
```

### Task 5: Create expandable file row component

**Files:**
- Create: `apps/web/src/components/files/expandable-file-row.tsx`

- [ ] **Step 1: Create component**

```typescript
"use client";

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { TableCell, TableRow } from "@/components/ui/table";
import { useFileProviders } from "@/hooks/use-files";
import { useFileStatusEvents } from "@/hooks/use-file-events";
import { SPStatusRow } from "./sp-status-row";

interface ExpandableFileRowProps {
	cid: string;
	status: string;
	children: React.ReactNode;
}

export function ExpandableFileRow({ cid, status, children }: ExpandableFileRowProps) {
	const [expanded, setExpanded] = useState(false);
	const { address } = useAccount();
	const isTerminal = status === "fully_replicated" || status === "failed";

	// Subscribe to real-time updates for non-terminal files
	useFileStatusEvents(!isTerminal ? cid : null, address);

	// Fetch provider details when expanded
	const { data, isLoading } = useFileProviders(expanded ? cid : null);

	return (
		<>
			<TableRow
				className="cursor-pointer hover:bg-accent/50"
				onClick={() => setExpanded(!expanded)}
			>
				<TableCell className="w-8 px-2">
					{expanded ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</TableCell>
				{children}
			</TableRow>
			{expanded && (
				<TableRow>
					<TableCell colSpan={8} className="p-0">
						<div className="bg-muted/30 border-t border-border/50 py-2">
							<div className="px-4 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Storage Providers
							</div>
							{isLoading ? (
								<div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" />
									Loading providers...
								</div>
							) : data?.providers?.length ? (
								data.providers.map((sp) => (
									<SPStatusRow
										key={sp.spId}
										spId={sp.spId}
										status={sp.status}
										txHash={sp.txHash}
										pieceCid={sp.pieceCid}
										verifiedAt={sp.verifiedAt}
									/>
								))
							) : (
								<div className="px-4 py-3 text-sm text-muted-foreground">
									No providers assigned yet
								</div>
							)}
						</div>
					</TableCell>
				</TableRow>
			)}
		</>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/files/expandable-file-row.tsx
git commit -m "feat: expandable file row with real-time per-SP status"
```

### Task 6: Update FileTable with expandable rows and variant prop

**Files:**
- Modify: `apps/web/src/components/files/file-table.tsx`

- [ ] **Step 1: Add variant prop and ExpandableFileRow import**

Add import at top:
```typescript
import { ExpandableFileRow } from "./expandable-file-row";
```

Update the component signature to accept a `variant` prop:
```typescript
interface FileTableProps {
	files: FileRow[];
	variant?: "user" | "agent-activity";
}

export function FileTable({ files, variant = "user" }: FileTableProps) {
```

- [ ] **Step 2: Update table header — add expand column, conditionally show Name vs PieceCID**

Replace the `<TableHeader>` section. When `variant === "agent-activity"`, show PieceCID instead of Name:

```tsx
<TableHeader>
	<TableRow>
		<TableHead className="w-8" />
		{variant === "user" ? (
			<TableHead>
				<button type="button" onClick={() => toggleSort("name")} className="flex items-center hover:text-foreground transition-colors">
					Name <SortIcon active={sortKey === "name"} dir={sortDir} />
				</button>
			</TableHead>
		) : (
			<TableHead>PieceCID</TableHead>
		)}
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
```

- [ ] **Step 3: Update table body — wrap each row with ExpandableFileRow**

Replace the `<TableBody>` content. Each row is now wrapped in `ExpandableFileRow` which handles the expand/collapse and per-SP detail:

```tsx
<TableBody>
	{sorted.map((file) => (
		<ExpandableFileRow key={file.cid} cid={file.cid} status={file.status}>
			{variant === "user" ? (
				<TableCell className="font-medium">{getName(file)}</TableCell>
			) : (
				<TableCell>
					{file.piece_cid ? (
						<button
							type="button"
							onClick={(e) => { e.stopPropagation(); copyCid(file.piece_cid!); }}
							className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
						>
							{file.piece_cid.slice(0, 16)}...
							<Copy className="h-3 w-3" />
						</button>
					) : (
						<span className="text-xs text-muted-foreground">—</span>
					)}
				</TableCell>
			)}
			<TableCell>
				<button
					type="button"
					onClick={(e) => { e.stopPropagation(); copyCid(file.cid); }}
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
				<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
					<a href={getIpfsUrl(file.cid)} target="_blank" rel="noopener noreferrer" title="View on IPFS">
						<Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
					</a>
					{file.piece_cid && (
						<a href={getPdpExplorerUrl(file.piece_cid)} target="_blank" rel="noopener noreferrer" title="PDP Explorer">
							<Button variant="ghost" size="sm" className="text-xs font-mono">PDP</Button>
						</a>
					)}
					{file.payment_tx_hash && (
						<a href={getPaymentExplorerUrl(file.payment_tx_hash, file.payment_network)} target="_blank" rel="noopener noreferrer" title={`Payment on ${getNetworkLabel(file.payment_network)}`}>
							<Button variant="ghost" size="sm" className="text-xs font-mono">Pay</Button>
						</a>
					)}
				</div>
			</TableCell>
		</ExpandableFileRow>
	))}
	{files.length === 0 && (
		<TableRow>
			<TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
				No files yet
			</TableCell>
		</TableRow>
	)}
</TableBody>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/files/file-table.tsx
git commit -m "feat: file table with expandable rows and agent-activity variant"
```

---

## Chunk 3: Upload Modal

### Task 7: Create upload modal component

**Files:**
- Create: `apps/web/src/components/files/upload-modal.tsx`

- [ ] **Step 1: Create the modal**

This adapts the existing upload page logic into a Dialog. Key flow: select file → pay → show pinning → close on success.

```typescript
"use client";

import { Check, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUploadFile } from "@/hooks/use-files";
import { useX402 } from "@/hooks/use-x402";
import { UploadZone } from "./upload-zone";

export function UploadModal() {
	const { isConnected } = useAccount();
	const { x402Fetch, isReady } = useX402();
	const uploadMutation = useUploadFile();
	const [open, setOpen] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [tags, setTags] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState("");
	const [status, setStatus] = useState<"idle" | "paying" | "pinning" | "done">("idle");

	function reset() {
		setFile(null);
		setTags("");
		setDescription("");
		setError("");
		setStatus("idle");
	}

	async function handleUpload() {
		if (!file) return;
		setError("");
		setStatus("paying");

		try {
			const formData = new FormData();
			formData.append("file", file);
			if (tags) formData.append("tags", tags);
			if (description) formData.append("description", description);

			setStatus("pinning");

			if (isReady) {
				const res = await x402Fetch("/upload", { method: "POST", body: formData });
				if (!res.ok) {
					const err = await res.json().catch(() => ({ error: "Upload failed" }));
					throw new Error(err.error ?? "Upload failed");
				}
				await res.json();
			} else {
				await uploadMutation.mutateAsync({ formData });
			}

			setStatus("done");
			// Close modal after brief success indicator
			setTimeout(() => {
				setOpen(false);
				reset();
			}, 1000);
		} catch (e: any) {
			setError(e.message);
			setStatus("idle");
		}
	}

	return (
		<Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
			<DialogTrigger asChild>
				<Button disabled={!isConnected}>
					<Upload className="mr-2 h-4 w-4" />
					Upload to Filecoin
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Upload to Filecoin</DialogTitle>
				</DialogHeader>

				{status === "done" ? (
					<div className="flex flex-col items-center gap-3 py-8">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
							<Check className="h-6 w-6 text-green-400" />
						</div>
						<p className="font-medium">File pinned to IPFS</p>
						<p className="text-sm text-muted-foreground">Replication to Filecoin SPs starting...</p>
					</div>
				) : (
					<div className="space-y-4">
						<UploadZone onFileSelect={setFile} selectedFile={file} onClear={() => setFile(null)} />
						<div>
							<label className="mb-1 block text-sm text-muted-foreground">Tags (comma-separated)</label>
							<Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="dataset, research" />
						</div>
						<div>
							<label className="mb-1 block text-sm text-muted-foreground">Description</label>
							<Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this file?" rows={2} />
						</div>
						{error && (
							<div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
								{error}
							</div>
						)}
						<Button
							onClick={handleUpload}
							disabled={!file || !isReady || status !== "idle"}
							className="w-full"
						>
							{status === "pinning" ? (
								<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Pinning to IPFS...</>
							) : status === "paying" ? (
								<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirming payment...</>
							) : (
								"Upload & Pay with x402"
							)}
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/files/upload-modal.tsx
git commit -m "feat: upload modal with x402 payment and pinning status"
```

---

## Chunk 4: Dashboard Tabbed Layout

### Task 8: Rewrite dashboard page as tabbed layout

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Rewrite the dashboard page**

Replace the entire file. The Files tab shows metrics + file table + upload button. Chat and Workflows tabs lazily load their existing components.

```typescript
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useAccount } from "wagmi";
import { MetricsCard } from "@/components/dashboard/metrics-card";
import { FileTable } from "@/components/files/file-table";
import { UploadModal } from "@/components/files/upload-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { SpotlightGrid } from "@/components/ui/spotlight-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlatformEvents } from "@/hooks/use-file-events";
import { useFiles } from "@/hooks/use-files";
import { useConversations } from "@/hooks/use-conversations";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ChatContent = dynamic(() => import("./chat/page"), { ssr: false });
const WorkflowsContent = dynamic(
	() => import("@/app/swarm/page"),
	{ ssr: false },
);

export default function DashboardPage() {
	const { isConnected } = useAccount();
	const [page, setPage] = useState(1);
	const { data: filesData, isLoading: filesLoading } = useFiles(page, 20);
	const { data: convData } = useConversations();
	usePlatformEvents();

	if (!isConnected) {
		return (
			<div className="flex flex-col items-center justify-center gap-6 py-24">
				<h1 className="text-2xl font-bold">Connect to view your dashboard</h1>
				<p className="text-muted-foreground text-center max-w-md">
					Connect a wallet to see your files, storage metrics, and conversations.
				</p>
				<ConnectButton />
			</div>
		);
	}

	const files = filesData?.files ?? [];
	const allFiles = files;
	const totalFiles = filesData?.total ?? 0;
	const storageUsed = files.reduce((sum: number, f: any) => sum + (Number(f.size_bytes) || f.size || 0), 0);
	const replicated = files.filter((f: any) => f.status === "fully_replicated").length;
	const conversations = convData?.conversations?.length ?? 0;

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Dashboard</h1>

			<Tabs defaultValue="files">
				<TabsList>
					<TabsTrigger value="files">Files</TabsTrigger>
					<TabsTrigger value="chat">Chat</TabsTrigger>
					<TabsTrigger value="workflows">Workflows</TabsTrigger>
				</TabsList>

				<TabsContent value="files" className="space-y-6 mt-6">
					{filesLoading ? (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{[...Array(4)].map((_, i) => (
								<Skeleton key={i} className="h-28 rounded-xl" />
							))}
						</div>
					) : (
						<SpotlightGrid glowColor="59, 130, 246" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<MetricsCard data-spotlight-card title="Total Files" value={totalFiles} color="blue" />
							<MetricsCard data-spotlight-card title="Storage Used" value={storageUsed} format="bytes" color="green" />
							<MetricsCard data-spotlight-card title="Fully Replicated" value={replicated} color="purple" />
							<MetricsCard data-spotlight-card title="Conversations" value={conversations} color="orange" />
						</SpotlightGrid>
					)}

					<div className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">{totalFiles} files</span>
						<UploadModal />
					</div>

					<FileTable files={allFiles} />

					<div className="flex items-center justify-between">
						<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
							<ChevronLeft className="mr-1 h-4 w-4" /> Previous
						</Button>
						<span className="text-sm text-muted-foreground">Page {page}</span>
						<Button variant="outline" size="sm" disabled={!filesData?.hasMore} onClick={() => setPage((p) => p + 1)}>
							Next <ChevronRight className="ml-1 h-4 w-4" />
						</Button>
					</div>
				</TabsContent>

				<TabsContent value="chat" className="mt-6">
					<ChatContent />
				</TabsContent>

				<TabsContent value="workflows" className="mt-6">
					<WorkflowsContent />
				</TabsContent>
			</Tabs>
		</div>
	);
}
```

Note: The `ChatContent` and `WorkflowsContent` dynamic imports use the existing page components as-is. If they export `default`, they'll render correctly. The `swarm/page.tsx` renders its own `SiteHeader` and `SiteFooter` — we'll need to extract just the content. This is handled in the next step.

- [ ] **Step 2: Verify chat page exports default component**

Read `apps/web/src/app/dashboard/chat/page.tsx` — it should export `default function ChatPage()`. The dynamic import will use this. No changes needed if it does.

- [ ] **Step 3: Handle swarm page — it renders its own SiteHeader/SiteFooter**

The swarm page currently renders `<SiteHeader />` and `<SiteFooter />` inside itself. When embedded in the dashboard tab, this would duplicate the header. We need to conditionally skip them.

In `apps/web/src/app/swarm/page.tsx`, find and remove or conditionally skip the `<SiteHeader />` and `<SiteFooter />` wrappers. The cleanest approach: wrap the main content in a separate exported component.

Read the swarm page first, then extract the content between `<SiteHeader />` and `<SiteFooter />` into the default export, removing the header/footer. The dashboard layout already provides these.

- [ ] **Step 4: Delete old route pages**

```bash
rm apps/web/src/app/dashboard/upload/page.tsx
rm apps/web/src/app/dashboard/files/page.tsx
rm -rf apps/web/src/app/platform/
```

Keep `apps/web/src/app/dashboard/chat/page.tsx` (imported by dashboard).
Keep `apps/web/src/app/swarm/` for now (imported by dashboard, can redirect later).

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/app/dashboard/ apps/web/src/app/platform/ apps/web/src/app/swarm/
git commit -m "feat: dashboard tabbed layout — Files, Chat, Workflows"
```

---

## Chunk 5: Agent Activity Page

### Task 9: Build Agent Activity page

**Files:**
- Modify: `apps/web/src/app/agent-activity/page.tsx`

- [ ] **Step 1: Implement the full page**

```typescript
"use client";

import { useState } from "react";
import { StorageChart } from "@/components/dashboard/storage-chart";
import { FileTable } from "@/components/files/file-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlatformEvents } from "@/hooks/use-file-events";
import { usePlatformActivity, usePlatformMetrics } from "@/hooks/use-platform";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentActivityPage() {
	const { data: activity, isLoading } = usePlatformActivity();
	const { data: metrics } = usePlatformMetrics();
	usePlatformEvents();

	const chartData = (metrics?.uploadVolume ?? []).map((d: any) => ({
		...d,
		date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
	}));

	// Map platform activity to FileRow format for the table
	const files = (activity?.activity ?? []).map((f: any) => ({
		cid: f.cid,
		piece_cid: f.piece_cid,
		size_bytes: f.size_bytes,
		status: f.status,
		sp_count: f.sp_count,
		created_at: f.created_at,
	}));

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Agent Activity</h1>
			<p className="text-muted-foreground">
				Public view of storage agent operations on Filecoin. Verify any file on-chain.
			</p>

			<Tabs defaultValue="activity">
				<TabsList>
					<TabsTrigger value="activity">Recent Activity</TabsTrigger>
					<TabsTrigger value="volume">Upload Volume</TabsTrigger>
				</TabsList>

				<TabsContent value="activity" className="mt-6">
					{isLoading ? (
						<Skeleton className="h-64 rounded-xl" />
					) : (
						<FileTable files={files} variant="agent-activity" />
					)}
				</TabsContent>

				<TabsContent value="volume" className="mt-6">
					<StorageChart data={chartData} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
```

- [ ] **Step 2: Update platform activity API to return more items**

The current `/platform/activity` endpoint only returns 10 items. For a proper table we need pagination. However, the existing endpoint already supports `page` and `limit` params via `listAllFiles`. For now, increase the default to 50 in the route:

In `packages/api/src/routes/platform.ts`, change:
```typescript
const { files } = await listAllFiles({ page: 1, limit: 10 });
```
to:
```typescript
const page = Number(c.req.query("page") ?? "1");
const limit = Math.min(100, Number(c.req.query("limit") ?? "50"));
const { files, total, hasMore } = await listAllFiles({ page, limit });
return c.json({ activity: files, total, page, limit, hasMore });
```

And update the `usePlatformActivity` hook in `apps/web/src/hooks/use-platform.ts` if needed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/agent-activity/ packages/api/src/routes/platform.ts
git commit -m "feat: Agent Activity page with public file table and upload volume"
```

---

## Chunk 6: Cleanup & Verification

### Task 10: Final cleanup and typecheck

- [ ] **Step 1: Remove unused imports from deleted pages**

Check for any broken imports referencing deleted pages or the old platform route.

```bash
grep -r "dashboard/upload\|dashboard/files\|/platform\|/swarm" apps/web/src/ --include="*.tsx" --include="*.ts" -l
```

Fix any references found (update links, remove imports).

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Fix any type errors.

- [ ] **Step 3: Run API typecheck**

```bash
cd packages/api && bun run typecheck
```

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: cleanup broken imports and type errors from dashboard redesign"
```

- [ ] **Step 5: Verify dev server starts**

```bash
cd apps/web && bun run dev
```

Open `http://localhost:3000/dashboard` — should show tabbed layout.
Open `http://localhost:3000/agent-activity` — should show public file table.
