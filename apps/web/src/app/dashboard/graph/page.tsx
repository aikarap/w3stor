"use client";

import { Network, Search, X, ExternalLink, FileText, HardDrive, Clock, LogIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ForceGraph } from "./force-graph";
import type { GraphNode, GraphEdge } from "./force-graph";
import { apiFetch } from "@/hooks/use-api";

interface ApiGraphNode {
	walletAddress: string;
	cid: string;
	filename?: string;
	description?: string;
	tags?: string[];
	contentType?: string;
	sizeBytes?: number;
	addedAt?: string;
}

interface ApiGraphEdge {
	fromCid: string;
	toCid: string;
	relationship: string;
}

interface GraphViewResponse {
	nodes: ApiGraphNode[];
	edges: ApiGraphEdge[];
}

interface SearchResponse {
	results: ApiGraphNode[];
}

function toGraphNodes(apiNodes: ApiGraphNode[], wallet: string): GraphNode[] {
	const agentNode: GraphNode = {
		id: wallet,
		label: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
		type: "Agent",
		wallet,
	};

	const fileNodes: GraphNode[] = apiNodes.map((n) => ({
		id: n.cid,
		label: n.filename || (n.description ? n.description.slice(0, 30) : n.cid.slice(0, 12)),
		type: "File" as const,
		cid: n.cid,
		sizeBytes: n.sizeBytes,
		mimeType: n.contentType,
		createdAt: n.addedAt,
		wallet: n.walletAddress,
		description: n.description,
		tags: n.tags,
	}));

	return [agentNode, ...fileNodes];
}

function toGraphEdges(apiNodes: ApiGraphNode[], apiEdges: ApiGraphEdge[], wallet: string): GraphEdge[] {
	const nodeIds = new Set<string>([wallet, ...apiNodes.map((n) => n.cid)]);

	// HAS_FILE edges from agent to each file
	const ownerEdges: GraphEdge[] = apiNodes.map((n) => ({
		id: `${wallet}->${n.cid}`,
		source: wallet,
		target: n.cid,
		relationship: "HAS_FILE",
	}));

	// File-to-file edges — only include if both endpoints exist in the node set
	const fileEdges: GraphEdge[] = apiEdges
		.filter((e) => nodeIds.has(e.fromCid) && nodeIds.has(e.toCid))
		.map((e) => ({
			id: `${e.fromCid}->${e.toCid}:${e.relationship}`,
			source: e.fromCid,
			target: e.toCid,
			relationship: e.relationship,
		}));

	return [...ownerEdges, ...fileEdges];
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function FileDetailPanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
	const ipfsUrl = node.cid ? `https://ipfs.io/ipfs/${node.cid}` : null;

	return (
		<div className="w-80 shrink-0 rounded-xl border border-border/50 bg-card flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-border/30">
				<div className="min-w-0">
					<p className="text-xs text-muted-foreground mb-0.5">File</p>
					<p className="text-sm font-semibold truncate" title={node.label}>{node.label}</p>
					{node.mimeType && (
						<p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">{node.mimeType}</p>
					)}
				</div>
				<button
					type="button"
					onClick={onClose}
					className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>

			{/* Body */}
			<div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs">
				{node.description && (
					<p className="leading-relaxed text-muted-foreground">{node.description}</p>
				)}

				{node.tags && node.tags.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{node.tags.map((tag) => (
							<span
								key={tag}
								className="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/10"
							>
								{tag}
							</span>
						))}
					</div>
				)}

				{/* Meta grid */}
				<div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-1">
					{node.sizeBytes != null && (
						<div>
							<p className="text-muted-foreground/60 text-[10px] mb-0.5">Size</p>
							<p className="font-medium">{formatBytes(node.sizeBytes)}</p>
						</div>
					)}
					{node.createdAt && (
						<div>
							<p className="text-muted-foreground/60 text-[10px] mb-0.5">Added</p>
							<p className="font-medium">{new Date(node.createdAt).toLocaleDateString()}</p>
						</div>
					)}
					{node.status && (
						<div className="col-span-2">
							<p className="text-muted-foreground/60 text-[10px] mb-0.5">Status</p>
							<span
								className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
									node.status === "fully_replicated"
										? "bg-[#2ecc71]/15 text-[#2ecc71]"
										: "bg-yellow-500/15 text-yellow-400"
								}`}
							>
								{node.status}
							</span>
						</div>
					)}
				</div>

				{node.cid && (
					<div className="pt-1">
						<p className="text-muted-foreground/60 text-[10px] mb-0.5">CID</p>
						<p className="font-mono text-[10px] break-all text-muted-foreground leading-relaxed">{node.cid}</p>
					</div>
				)}
			</div>

			{/* Footer */}
			{ipfsUrl && (
				<div className="px-4 py-3 border-t border-border/30">
					<a
						href={ipfsUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center justify-center gap-1.5 h-8 w-full rounded-lg bg-[#6c63ff]/10 text-[#6c63ff] text-xs font-medium hover:bg-[#6c63ff]/20 transition-colors"
					>
						<ExternalLink className="h-3 w-3" />
						View on IPFS
					</a>
				</div>
			)}
		</div>
	);
}

const EDGE_PALETTE = [
	"#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
	"#1abc9c", "#e67e22", "#ec407a", "#26c6da", "#ab47bc",
];

function hashRelColor(rel: string): string {
	let h = 0;
	for (let i = 0; i < rel.length; i++) h = (h * 31 + rel.charCodeAt(i)) | 0;
	return EDGE_PALETTE[Math.abs(h) % EDGE_PALETTE.length];
}

function GraphLegend({ edges }: { edges: GraphEdge[] }) {
	const relTypes = [...new Set(edges.map((e) => e.relationship))].filter((r) => r !== "HAS_FILE");
	const [expanded, setExpanded] = useState(false);
	const visible = expanded ? relTypes : relTypes.slice(0, 4);

	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
			<div className="flex items-center gap-1">
				<span className="inline-block w-2.5 h-2.5 rounded-full bg-[#6c63ff]" />
				Agent
			</div>
			<div className="flex items-center gap-1">
				<span className="inline-block w-2.5 h-2.5 rounded-full bg-[#2ecc71]" />
				File
			</div>
			<span className="text-border">|</span>
			{visible.map((rel) => (
				<div key={rel} className="flex items-center gap-1">
					<span className="inline-block w-3 h-[2px] rounded-full" style={{ backgroundColor: hashRelColor(rel) }} />
					{rel.replaceAll("_", " ")}
				</div>
			))}
			{relTypes.length > 4 && (
				<button
					type="button"
					onClick={() => setExpanded(!expanded)}
					className="text-[#6c63ff] hover:underline"
				>
					{expanded ? "less" : `+${relTypes.length - 4} more`}
				</button>
			)}
		</div>
	);
}

function buildSiweMessage(address: string, nonce: string): string {
	const domain = typeof window !== "undefined" ? window.location.host : "w3stor.xyz";
	const uri = typeof window !== "undefined" ? window.location.origin : "https://w3stor.xyz";
	return [
		`${domain} wants you to sign in with your Ethereum account:`,
		address,
		"",
		"Sign in to W3Stor",
		"",
		`URI: ${uri}`,
		"Version: 1",
		"Chain ID: 84532",
		`Nonce: ${nonce}`,
		`Issued At: ${new Date().toISOString()}`,
	].join("\n");
}

const STORAGE_KEY_PREFIX = "w3stor_siwe_";

function saveToken(wallet: string, token: string): void {
	try {
		// JWT has 24h TTL — store expiry as iat + 24h
		const payload = JSON.parse(atob(token.split(".")[1]));
		const expiresAt = (payload.exp ?? Math.floor(Date.now() / 1000) + 86400) * 1000;
		localStorage.setItem(`${STORAGE_KEY_PREFIX}${wallet.toLowerCase()}`, JSON.stringify({ token, expiresAt }));
	} catch {}
}

function loadToken(wallet: string): string | null {
	try {
		const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${wallet.toLowerCase()}`);
		if (!raw) return null;
		const { token, expiresAt } = JSON.parse(raw);
		if (Date.now() >= expiresAt) {
			localStorage.removeItem(`${STORAGE_KEY_PREFIX}${wallet.toLowerCase()}`);
			return null;
		}
		return token;
	} catch {
		return null;
	}
}

function clearToken(wallet: string): void {
	try {
		localStorage.removeItem(`${STORAGE_KEY_PREFIX}${wallet.toLowerCase()}`);
	} catch {}
}

function GraphClient() {
	const { address, isConnected } = useAccount();
	const { signMessageAsync } = useSignMessage();

	const [authToken, setAuthToken] = useState<string | null>(null);
	const [authLoading, setAuthLoading] = useState(false);
	const [authError, setAuthError] = useState<string | null>(null);

	const [searchQuery, setSearchQuery] = useState("");
	const [nodes, setNodes] = useState<GraphNode[]>([]);
	const [edges, setEdges] = useState<GraphEdge[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
	const [searchResults, setSearchResults] = useState<GraphNode[] | null>(null);
	const [spread, setSpread] = useState(50);
	const [searchLimit, setSearchLimit] = useState(20);
	const [searchThreshold, setSearchThreshold] = useState(0.6);
	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const highlightSet = useMemo(
		() => searchResults !== null ? new Set(searchResults.map((r) => r.id)) : undefined,
		[searchResults],
	);

	// Restore token from localStorage on wallet change
	useEffect(() => {
		setAuthError(null);
		setNodes([]);
		setEdges([]);
		setSelectedNode(null);
		setSearchResults(null);
		if (address) {
			const saved = loadToken(address);
			setAuthToken(saved);
		} else {
			setAuthToken(null);
		}
	}, [address]);

	const authenticate = useCallback(async () => {
		if (!address) return;
		setAuthLoading(true);
		setAuthError(null);
		try {
			// 1. Get nonce
			const nonceData = await apiFetch<{ nonce: string }>("/auth/siwe/nonce");
			const nonce = nonceData.nonce;

			// 2. Build + sign SIWE message
			const message = buildSiweMessage(address, nonce);
			const signature = await signMessageAsync({ message });

			// 3. Verify with server
			const verifyData = await apiFetch<{ token: string }>("/auth/siwe/verify", {
				method: "POST",
				body: JSON.stringify({ message, signature }),
				headers: { "Content-Type": "application/json" },
			});

			setAuthToken(verifyData.token);
			if (address) saveToken(address, verifyData.token);
		} catch (e) {
			setAuthError(e instanceof Error ? e.message : "Sign-in failed");
		} finally {
			setAuthLoading(false);
		}
	}, [address, signMessageAsync]);

	// Fetch graph when authToken is available
	useEffect(() => {
		if (!authToken) {
			setNodes([]);
			setEdges([]);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		setSelectedNode(null);
		setSearchResults(null);

		apiFetch<GraphViewResponse>("/graph/view", {
			query: { limit: "2000" },
			headers: { Authorization: `Bearer ${authToken}` },
		})
			.then((data) => {
				if (cancelled) return;
				const wallet = address?.toLowerCase() ?? "";
				setNodes(toGraphNodes(data.nodes ?? [], wallet));
				setEdges(toGraphEdges(data.nodes ?? [], data.edges ?? [], wallet));
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : "Failed to load graph");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [authToken, address]);

	// Debounced semantic search
	useEffect(() => {
		if (!searchQuery.trim() || !authToken) {
			setSearchResults(null);
			return;
		}

		if (searchTimer.current) clearTimeout(searchTimer.current);

		searchTimer.current = setTimeout(() => {
			apiFetch<SearchResponse>("/graph/search", {
				query: { q: searchQuery, limit: String(searchLimit), threshold: String(searchThreshold) },
				headers: { Authorization: `Bearer ${authToken}` },
			})
				.then((data) => {
					const results = (data.results ?? []).map((r) => ({
						id: r.cid,
						label: r.filename || r.cid.slice(0, 12),
						type: "File" as const,
						cid: r.cid,
						sizeBytes: r.sizeBytes,
						mimeType: r.contentType,
						description: r.description,
						tags: r.tags,
					}));
					setSearchResults(results);
				})
				.catch(() => {
					setSearchResults([]);
				});
		}, 400);

		return () => {
			if (searchTimer.current) clearTimeout(searchTimer.current);
		};
	}, [searchQuery, authToken, searchLimit, searchThreshold]);


	if (!isConnected) {
		return (
			<div className="flex flex-col items-center justify-center gap-6 py-24">
				<Network className="h-12 w-12 text-[#6c63ff] opacity-60" />
				<h2 className="text-xl font-semibold">Connect to explore your Memory Graph</h2>
				<p className="text-muted-foreground text-center max-w-md text-sm">
					Connect a wallet to visualize how your files and agent activity are interconnected across Filecoin.
				</p>
				<ConnectButton />
			</div>
		);
	}

	// Wallet connected but not authenticated
	if (!authToken) {
		return (
			<div className="flex flex-col items-center justify-center gap-6 py-24">
				<Network className="h-12 w-12 text-[#6c63ff] opacity-60" />
				<h2 className="text-xl font-semibold">Sign in to view your Memory Graph</h2>
				<p className="text-muted-foreground text-center max-w-md text-sm">
					Sign a message with your wallet to authenticate and load your graph data.
				</p>
				{authError && (
					<p className="text-sm text-red-400 max-w-md text-center">{authError}</p>
				)}
				<button
					type="button"
					onClick={authenticate}
					disabled={authLoading}
					className="flex items-center gap-2 h-10 px-5 rounded-lg bg-[#6c63ff] text-white text-sm font-medium hover:bg-[#5b53ee] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
				>
					<LogIn className="h-4 w-4" />
					{authLoading ? "Signing in…" : "Sign In with Ethereum"}
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Controls row */}
			<div className="flex flex-wrap items-end gap-3">
				{/* Authenticated badge */}
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span className="inline-block w-2 h-2 rounded-full bg-[#2ecc71]" />
					Signed in as <span className="font-mono">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
					<button
						type="button"
						onClick={() => { setAuthToken(null); if (address) clearToken(address); }}
						className="ml-1 text-muted-foreground hover:text-foreground transition-colors underline"
					>
						Sign out
					</button>
				</div>

				{/* Search bar */}
				<div className="relative flex-1 min-w-[220px]">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Semantic search across files..."
						className="h-9 w-full rounded-lg border border-border/60 bg-card pl-9 pr-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#6c63ff]/50"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => { setSearchQuery(""); setSearchResults(null); }}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					)}
					{searchResults && searchResults.length > 0 && (
						<span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-[#6c63ff] text-white text-[10px] font-bold">
							{searchResults.length}
						</span>
					)}
				</div>
			</div>

			{/* Legend */}
			<GraphLegend edges={edges} />

			{/* Controls row */}
			<div className="flex flex-wrap items-center gap-5 text-[11px] text-muted-foreground">
				<div className="flex items-center gap-1.5">
					<span className="text-muted-foreground/60">Layout</span>
					<input
						type="range"
						min={0}
						max={100}
						value={spread}
						onChange={(e) => setSpread(Number(e.target.value))}
						className="w-20 h-1 accent-[#6c63ff] cursor-pointer"
					/>
				</div>
				<span className="text-border">|</span>
				<div className="flex items-center gap-1.5">
					<span className="text-muted-foreground/60">Max results</span>
					<input
						type="range"
						min={5}
						max={100}
						step={5}
						value={searchLimit}
						onChange={(e) => setSearchLimit(Number(e.target.value))}
						className="w-16 h-1 accent-[#6c63ff] cursor-pointer"
					/>
					<span className="font-mono text-[10px] tabular-nums w-5 text-right">{searchLimit}</span>
				</div>
				<div className="flex items-center gap-1.5">
					<span className="text-muted-foreground/60">Min score</span>
					<input
						type="range"
						min={0}
						max={100}
						value={Math.round(searchThreshold * 100)}
						onChange={(e) => setSearchThreshold(Number(e.target.value) / 100)}
						className="w-16 h-1 accent-[#6c63ff] cursor-pointer"
					/>
					<span className="font-mono text-[10px] tabular-nums w-7 text-right">{searchThreshold.toFixed(2)}</span>
				</div>
			</div>

			{/* Graph canvas + detail panel */}
			<div className="flex gap-3" style={{ height: "calc(100vh - 310px)", minHeight: "480px" }}>
				<div className="flex-1 rounded-xl border border-border/50 bg-card/30 overflow-hidden relative">
					{loading && (
						<div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
							<div className="flex flex-col items-center gap-3">
								<div className="h-8 w-8 rounded-full border-2 border-[#6c63ff] border-t-transparent animate-spin" />
								<p className="text-xs text-muted-foreground">Loading graph…</p>
							</div>
						</div>
					)}
					{error && (
						<div className="absolute inset-0 flex items-center justify-center z-10">
							<div className="text-center">
								<p className="text-sm text-red-400 mb-2">{error}</p>
								<button
									type="button"
									onClick={() => setAuthToken((t) => t)}
									className="text-xs text-[#6c63ff] hover:underline"
								>
									Retry
								</button>
							</div>
						</div>
					)}
					{!loading && !error && nodes.length === 0 && authToken && (
						<div className="absolute inset-0 flex items-center justify-center">
							<p className="text-sm text-muted-foreground">No graph data found for this wallet.</p>
						</div>
					)}
					<ForceGraph
						nodes={nodes}
						edges={edges}
						onNodeClick={setSelectedNode}
						chargeStrength={-(30 + spread * 3.7)}
						highlightIds={highlightSet}
					/>
				</div>

				{selectedNode && <FileDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
			</div>
		</div>
	);
}

export default function KnowledgeGraphPage() {
	return (
		<div className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold flex items-center gap-2">
					<Network className="h-5 w-5 text-[#6c63ff]" />
					Memory Graph
				</h2>
				<p className="text-sm text-muted-foreground mt-1">
					Explore the semantic relationships between your files and agent activity stored on Filecoin. Drag nodes to
					rearrange, click a file node to view its metadata, and use semantic search to find related content.
				</p>
			</div>
			<GraphClient />
		</div>
	);
}
