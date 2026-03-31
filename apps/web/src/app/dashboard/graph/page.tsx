"use client";

import { Network, Search, X, ExternalLink, FileText, HardDrive, Clock, LogIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
		label: n.filename || n.cid.slice(0, 12),
		type: "File" as const,
		cid: n.cid,
		sizeBytes: n.sizeBytes,
		mimeType: n.contentType,
		createdAt: n.addedAt,
		wallet: n.walletAddress,
	}));

	return [agentNode, ...fileNodes];
}

function toGraphEdges(apiNodes: ApiGraphNode[], apiEdges: ApiGraphEdge[], wallet: string): GraphEdge[] {
	// HAS_FILE edges from agent to each file
	const ownerEdges: GraphEdge[] = apiNodes.map((n) => ({
		id: `${wallet}->${n.cid}`,
		source: wallet,
		target: n.cid,
		relationship: "HAS_FILE",
	}));

	// File-to-file edges
	const fileEdges: GraphEdge[] = apiEdges.map((e) => ({
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
		<div className="w-80 shrink-0 rounded-xl border border-border/50 bg-card p-5 flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm font-semibold">
					<FileText className="h-4 w-4 text-[#2ecc71]" />
					File Details
				</div>
				<button
					type="button"
					onClick={onClose}
					className="text-muted-foreground hover:text-foreground transition-colors"
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			<div className="space-y-3 text-sm">
				<div>
					<p className="text-muted-foreground text-xs mb-1">Name</p>
					<p className="font-medium break-all">{node.label}</p>
				</div>

				{node.cid && (
					<div>
						<p className="text-muted-foreground text-xs mb-1">CID</p>
						<p className="font-mono text-xs break-all text-[#6c63ff]">{node.cid}</p>
					</div>
				)}

				{node.mimeType && (
					<div>
						<p className="text-muted-foreground text-xs mb-1">MIME Type</p>
						<p className="font-mono text-xs">{node.mimeType}</p>
					</div>
				)}

				{node.sizeBytes != null && (
					<div className="flex items-center gap-2">
						<HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
						<p>{formatBytes(node.sizeBytes)}</p>
					</div>
				)}

				{node.status && (
					<div>
						<p className="text-muted-foreground text-xs mb-1">Status</p>
						<span
							className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
								node.status === "fully_replicated"
									? "bg-[#2ecc71]/15 text-[#2ecc71]"
									: "bg-yellow-500/15 text-yellow-400"
							}`}
						>
							{node.status}
						</span>
					</div>
				)}

				{node.createdAt && (
					<div className="flex items-center gap-2 text-muted-foreground">
						<Clock className="h-3.5 w-3.5" />
						<p className="text-xs">{new Date(node.createdAt).toLocaleString()}</p>
					</div>
				)}
			</div>

			{ipfsUrl && (
				<a
					href={ipfsUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-2 text-xs text-[#6c63ff] hover:underline mt-auto"
				>
					<ExternalLink className="h-3.5 w-3.5" />
					View on IPFS Gateway
				</a>
			)}
		</div>
	);
}

function GraphLegend() {
	return (
		<div className="flex items-center gap-5 text-xs text-muted-foreground">
			<div className="flex items-center gap-1.5">
				<span className="inline-block w-3 h-3 rounded-full bg-[#6c63ff]" />
				Agent
			</div>
			<div className="flex items-center gap-1.5">
				<span className="inline-block w-3 h-3 rounded-full bg-[#2ecc71]" />
				File
			</div>
			<div className="flex items-center gap-1.5">
				<span className="inline-block w-5 h-[2px] bg-[#6c63ff]" />
				OWNS
			</div>
			<div className="flex items-center gap-1.5">
				<span className="inline-block w-5 h-[2px] bg-[#f39c12]" />
				SIMILAR_TO
			</div>
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
	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
				query: { q: searchQuery },
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
	}, [searchQuery, authToken]);

	const handleSearchResultClick = useCallback(
		(node: GraphNode) => {
			setSearchQuery("");
			setSearchResults(null);
			setSelectedNode(node);
		},
		[],
	);

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
						className="h-9 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#6c63ff]/50"
					/>
					{/* Search results dropdown */}
					{searchResults && searchResults.length > 0 && (
						<div className="absolute top-10 left-0 right-0 z-20 rounded-lg border border-border/60 bg-card shadow-lg overflow-hidden">
							{searchResults.map((node) => (
								<button
									key={node.id}
									type="button"
									onClick={() => handleSearchResultClick(node)}
									className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left"
								>
									<span className="inline-block w-2 h-2 rounded-full bg-[#2ecc71] shrink-0" />
									<span className="truncate">{node.label}</span>
									{node.sizeBytes != null && (
										<span className="ml-auto text-muted-foreground shrink-0">{formatBytes(node.sizeBytes)}</span>
									)}
								</button>
							))}
						</div>
					)}
					{searchResults && searchResults.length === 0 && (
						<div className="absolute top-10 left-0 right-0 z-20 rounded-lg border border-border/60 bg-card shadow-lg px-3 py-2 text-xs text-muted-foreground">
							No results found
						</div>
					)}
				</div>
			</div>

			{/* Legend */}
			<GraphLegend />

			{/* Graph canvas + detail panel */}
			<div className="flex gap-4" style={{ height: "calc(100vh - 340px)", minHeight: "480px" }}>
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
					<ForceGraph nodes={nodes} edges={edges} onNodeClick={setSelectedNode} />
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
