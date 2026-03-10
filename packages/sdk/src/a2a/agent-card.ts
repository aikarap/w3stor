import type { AgentCard } from "@a2a-js/sdk";
import { config, SERVER } from "@w3stor/shared";

const a2aUrl = process.env.A2A_URL || SERVER.getPublicUrl("/a2a/jsonrpc");

// Derive payment config from centralized config
const primaryNetwork = config.x402.networks[0];
const primaryToken = primaryNetwork?.tokens[0];

export const web3StorageAgentCard: AgentCard = {
	name: "w3stor",
	description:
		"Decentralized storage service for AI agents — instant IPFS uploads, permanent Filecoin replication, and trustless x402 micropayments. Supports conversational multi-turn storage workflows.",

	url: a2aUrl,
	preferredTransport: "JSONRPC",

	provider: {
		organization: "w3stor",
		url: "https://github.com/aikarap/w3stor",
	},

	version: "0.2.0",
	protocolVersion: "0.3.0",

	capabilities: {
		streaming: true,
		pushNotifications: false,
		stateTransitionHistory: true,
	},

	defaultInputModes: ["text", "application/octet-stream"],
	defaultOutputModes: ["text", "application/json"],

	documentationUrl: process.env.DOCS_URL || SERVER.getPublicUrl("/docs"),

	skills: [
		{
			id: "upload",
			name: "Upload File",
			description:
				"Upload a file to Web3 Storage with instant IPFS pinning and queued Filecoin replication. Requires x402 payment via Base Sepolia USDC.",
			tags: ["storage", "ipfs", "filecoin", "upload", "x402"],
			inputModes: ["application/octet-stream", "text"],
			outputModes: ["application/json"],
			examples: [
				JSON.stringify({
					action: "upload",
					params: {
						filename: "research-paper.pdf",
						metadata: { tags: ["research", "ml"], description: "ML training results" },
					},
				}),
			],
		},
		{
			id: "list",
			name: "List Files",
			description:
				"List all files uploaded by a wallet address with pagination, filtering by status or tags.",
			tags: ["storage", "list", "query"],
			inputModes: ["text"],
			outputModes: ["application/json"],
			examples: [
				JSON.stringify({
					action: "list",
					params: { wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", page: 1, limit: 20 },
				}),
			],
		},
		{
			id: "status",
			name: "Check File Status",
			description:
				"Check the replication status of a file across Pinata and Filecoin storage providers. Returns per-SP status and verification details.",
			tags: ["storage", "status", "query", "filecoin"],
			inputModes: ["text"],
			outputModes: ["application/json"],
			examples: [
				JSON.stringify({
					action: "status",
					params: { cid: "bafkreigdhmhrkl..." },
				}),
			],
		},
		{
			id: "attest",
			name: "Attest File Replication",
			description:
				"Generate a cryptographic attestation proving a file is replicated across Filecoin storage providers. Returns verification hashes, provider details, and on-chain proof. Requires x402 payment.",
			tags: ["storage", "attestation", "verification", "filecoin", "proof", "x402"],
			inputModes: ["text"],
			outputModes: ["application/json"],
			examples: [
				JSON.stringify({
					action: "attest",
					params: { cid: "bafkreigdhmhrkl..." },
				}),
			],
		},
		{
			id: "converse",
			name: "Conversational Storage",
			description:
				"Natural language interface for storing, listing, and managing files on Filecoin. Supports multi-turn dialogue with automatic intent detection. The agent guides you through uploads, status checks, and file management conversationally.",
			tags: ["conversation", "storage", "filecoin", "natural-language", "multi-turn"],
			inputModes: ["text", "application/octet-stream"],
			outputModes: ["text", "application/json"],
			examples: [
				"I want to store a research paper on Filecoin",
				"Can you save this document permanently?",
				"What files have I stored?",
				"Check the status of my latest upload",
			],
		},
	],

	// x402 payment serves as authorization — no traditional auth schemes needed.
	// Agents pay per-request via x402 headers on Base Sepolia using USDC.
	securitySchemes: {},
	security: [],

	additionalInterfaces: [
		{
			url: process.env.A2A_URL
				? `${process.env.A2A_URL}/a2a/jsonrpc`
				: SERVER.getPublicUrl("/a2a/jsonrpc"),
			transport: "JSONRPC",
		},
		{
			url: process.env.A2A_URL
				? `${process.env.A2A_URL}/a2a/rest`
				: SERVER.getPublicUrl("/a2a/rest"),
			transport: "HTTP+JSON",
		},
	],

	supportsAuthenticatedExtendedCard: false,
};
