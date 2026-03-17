"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
	AlertCircle,
	Bot,
	CheckCircle2,
	Clock,
	Copy,
	FileText,
	HardDrive,
	Sparkles,
	Upload,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import {
	Artifact,
	ArtifactAction,
	ArtifactActions,
	ArtifactContent,
	ArtifactDescription,
	ArtifactHeader,
	ArtifactTitle,
} from "@/components/ai-elements/artifact";
import {
	Attachment,
	AttachmentPreview,
	AttachmentRemove,
	Attachments,
} from "@/components/ai-elements/attachments";
import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { Checkpoint, CheckpointIcon } from "@/components/ai-elements/checkpoint";
import {
	Context,
	ContextContent,
	ContextContentBody,
	ContextContentFooter,
	ContextContentHeader,
	ContextInputUsage,
	ContextOutputUsage,
	ContextTrigger,
} from "@/components/ai-elements/context";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
	InlineCitation,
	InlineCitationCard,
	InlineCitationCardBody,
	InlineCitationCardTrigger,
	InlineCitationSource,
	InlineCitationText,
} from "@/components/ai-elements/inline-citation";
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
	MessageResponse,
} from "@/components/ai-elements/message";
import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorEmpty,
	ModelSelectorGroup,
	ModelSelectorInput,
	ModelSelectorItem,
	ModelSelectorList,
	ModelSelectorLogo,
	ModelSelectorName,
	ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
	Plan,
	PlanContent,
	PlanDescription,
	PlanHeader,
	PlanTitle,
	PlanTrigger,
} from "@/components/ai-elements/plan";
import {
	PromptInput,
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputBody,
	PromptInputButton,
	PromptInputFooter,
	type PromptInputMessage,
	PromptInputProvider,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
	Queue,
	QueueItem,
	QueueItemContent,
	QueueItemIndicator,
	QueueList,
	QueueSection,
	QueueSectionContent,
	QueueSectionLabel,
	QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import { useX402 } from "@/hooks/use-x402";

// ---------------------------------------------------------------------------
// Models available via AI Gateway
// ---------------------------------------------------------------------------

const MODELS = [
	{ id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" as const },
	{ id: "gpt-4o", name: "GPT-4o", provider: "openai" as const },
	{ id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" as const },
	{ id: "deepseek-chat", name: "DeepSeek V3", provider: "deepseek" as const },
];

const suggestions = [
	"How do I upload a file?",
	"What is x402 payment?",
	"Check status of a CID",
	"Show me the API endpoints",
];

// ---------------------------------------------------------------------------
// Attachments display (reads from PromptInput's internal context)
// ---------------------------------------------------------------------------

function PromptInputAttachmentsDisplay() {
	const attachments = usePromptInputAttachments();
	if (attachments.files.length === 0) return null;
	return (
		<Attachments variant="inline">
			{attachments.files.map((attachment) => (
				<Attachment
					data={attachment}
					key={attachment.id}
					onRemove={() => attachments.remove(attachment.id)}
				>
					<AttachmentPreview />
					<AttachmentRemove />
				</Attachment>
			))}
		</Attachments>
	);
}

// ---------------------------------------------------------------------------
// Upload queue tracker
// ---------------------------------------------------------------------------

interface UploadQueueEntry {
	id: string;
	filename: string;
	size: number;
	file: File;
	completed: boolean;
	status: "pending" | "uploading" | "done" | "failed";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Tool output renderers — Artifact cards for known tools
// ---------------------------------------------------------------------------

function FileStatusCard({ data }: { data: Record<string, unknown> }) {
	const file = data.file as Record<string, unknown> | undefined;
	const providers = (data.providers ?? data.storage_providers ?? []) as Record<string, unknown>[];
	const status = (data.status ?? file?.status ?? "unknown") as string;

	const statusIcon = {
		active: <CheckCircle2 className="h-4 w-4 text-green-500" />,
		pending: <Clock className="h-4 w-4 text-yellow-500" />,
		failed: <AlertCircle className="h-4 w-4 text-red-500" />,
	}[status] ?? <Clock className="h-4 w-4 text-muted-foreground" />;

	const cid = (data.cid ?? file?.cid ?? "") as string;
	const filename = (file?.filename ?? file?.original_filename ?? data.filename ?? "") as string;
	const size = (file?.size ?? data.size ?? data.file_size) as number | undefined;

	return (
		<Artifact className="my-2">
			<ArtifactHeader>
				<div className="flex items-center gap-2">
					{statusIcon}
					<ArtifactTitle className="text-sm font-medium">{filename || "File Status"}</ArtifactTitle>
				</div>
				<ArtifactDescription className="text-xs text-muted-foreground">
					{status}
				</ArtifactDescription>
			</ArtifactHeader>
			<ArtifactContent className="space-y-2 p-3 text-xs">
				{cid && (
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">CID:</span>
						<a
							href={`https://ipfs.io/ipfs/${cid}`}
							target="_blank"
							rel="noopener noreferrer"
							className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-blue-500 hover:text-blue-400 hover:underline"
						>
							{cid.length > 20 ? `${cid.slice(0, 10)}...${cid.slice(-10)}` : cid}
						</a>
					</div>
				)}
				{size != null && (
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">Size:</span>
						<span>{formatBytes(size)}</span>
					</div>
				)}
				{providers.length > 0 && (
					<div>
						<span className="text-muted-foreground">Providers ({providers.length}):</span>
						<div className="mt-1 space-y-1">
							{providers.map((p, i) => (
								<div key={i} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1">
									<HardDrive className="h-3 w-3 text-muted-foreground" />
									<span className="font-mono text-[11px]">
										{(p.provider_id ?? p.id ?? `SP-${i + 1}`) as string}
									</span>
									<span
										className={`ml-auto text-[10px] ${(p.status as string) === "active" ? "text-green-500" : "text-yellow-500"}`}
									>
										{(p.status ?? "pending") as string}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</ArtifactContent>
			{cid && (
				<ArtifactActions className="border-t px-3 py-2">
					<ArtifactAction
						tooltip="Copy CID"
						size="sm"
						variant="ghost"
						onClick={() => navigator.clipboard.writeText(cid)}
					>
						<Copy className="h-3 w-3" />
					</ArtifactAction>
				</ArtifactActions>
			)}
		</Artifact>
	);
}

function FileListCard({ data }: { data: Record<string, unknown> }) {
	const files = (data.files ?? data.user_files ?? []) as Record<string, unknown>[];

	if (files.length === 0) {
		return (
			<Artifact className="my-2">
				<ArtifactContent className="p-4 text-center text-sm text-muted-foreground">
					No files found for this wallet.
				</ArtifactContent>
			</Artifact>
		);
	}

	return (
		<Artifact className="my-2">
			<ArtifactHeader>
				<ArtifactTitle className="text-sm font-medium">Files ({files.length})</ArtifactTitle>
			</ArtifactHeader>
			<ArtifactContent className="divide-y divide-border">
				{files.map((f, i) => {
					const cid = (f.cid ?? "") as string;
					const name = (f.filename ?? f.original_filename ?? "Unnamed") as string;
					const size = f.size as number | undefined;
					const fileStatus = (f.status ?? "unknown") as string;
					return (
						<div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
							<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<div className="truncate font-medium">{name}</div>
								{cid && (
									<a
										href={`https://ipfs.io/ipfs/${cid}`}
										target="_blank"
										rel="noopener noreferrer"
										className="truncate font-mono text-[10px] text-blue-500 hover:text-blue-400 hover:underline"
									>
										{cid}
									</a>
								)}
							</div>
							{size != null && (
								<span className="shrink-0 text-muted-foreground">{formatBytes(size)}</span>
							)}
							<span
								className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${fileStatus === "active" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}`}
							>
								{fileStatus}
							</span>
						</div>
					);
				})}
			</ArtifactContent>
		</Artifact>
	);
}

/** Upload tool card — shows Sign & Upload when pending, result when complete */
function UploadToolCard({
	toolPart,
	onApprove,
	onReject,
}: {
	toolPart: {
		state: string;
		toolCallId: string;
		input?: unknown;
		output?: unknown;
	};
	onApprove: (toolCallId: string) => void;
	onReject: (toolCallId: string) => void;
}) {
	const input = toolPart.input as Record<string, unknown> | undefined;
	const filename = (input?.filename ?? "file") as string;
	const size = input?.size as number | undefined;
	const output = toolPart.output as Record<string, unknown> | undefined;
	const hasOutput = toolPart.state === "output-available" || toolPart.state === "output-error";
	const outputStatus = (output?.status ?? "") as string;

	return (
		<Artifact className="my-2">
			<ArtifactHeader>
				<div className="flex items-center gap-2">
					<Upload
						className={`h-4 w-4 ${hasOutput ? (outputStatus === "failed" ? "text-red-500" : "text-green-500") : "animate-pulse text-primary"}`}
					/>
					<ArtifactTitle className="text-sm font-medium">Upload {filename}</ArtifactTitle>
					{size != null && (
						<ArtifactDescription className="text-xs text-muted-foreground">
							{formatBytes(size)}
						</ArtifactDescription>
					)}
				</div>
			</ArtifactHeader>

			{/* Pending — show Sign & Upload button */}
			{!hasOutput && (
				<ArtifactContent className="p-3">
					<p className="mb-3 text-sm text-muted-foreground">
						This will initiate an x402 micropayment to upload <strong>{filename}</strong> to
						Filecoin via 3+ Storage Providers.
					</p>
					<div className="flex items-center justify-end gap-2">
						<button
							type="button"
							className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
							onClick={() => onReject(toolPart.toolCallId)}
						>
							Cancel
						</button>
						<button
							type="button"
							className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
							onClick={() => onApprove(toolPart.toolCallId)}
						>
							<Sparkles className="h-3.5 w-3.5" />
							Sign & Upload
						</button>
					</div>
				</ArtifactContent>
			)}

			{/* Uploading */}
			{hasOutput && outputStatus === "uploading" && (
				<ArtifactContent className="p-3">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<div className="flex gap-1">
							<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
							<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
							<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
						</div>
						Uploading to Filecoin...
					</div>
				</ArtifactContent>
			)}

			{/* Success */}
			{hasOutput && (outputStatus === "approved" || outputStatus === "done") && (
				<ArtifactContent className="space-y-2 p-3">
					<div className="flex items-center gap-2 text-sm text-green-600">
						<CheckCircle2 className="h-4 w-4" />
						Upload complete
					</div>
					<div className="space-y-1.5 text-xs">
						{typeof output?.cid === "string" && (
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground">CID:</span>
								<a
									href={`https://ipfs.io/ipfs/${output.cid}`}
									target="_blank"
									rel="noopener noreferrer"
									className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-blue-500 hover:text-blue-400 hover:underline"
								>
									{output.cid.length > 30
										? `${output.cid.slice(0, 12)}...${output.cid.slice(-12)}`
										: output.cid}
								</a>
								<button
									type="button"
									className="text-muted-foreground hover:text-foreground"
									onClick={() => navigator.clipboard.writeText(String(output.cid))}
								>
									<Copy className="h-3 w-3" />
								</button>
							</div>
						)}
						{(typeof output?.filename === "string" ||
							typeof output?.original_filename === "string") && (
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground">File:</span>
								<span>{String(output.filename ?? output.original_filename)}</span>
							</div>
						)}
						{output?.size != null && (
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground">Size:</span>
								<span>{formatBytes(Number(output.size))}</span>
							</div>
						)}
						{typeof output?.cost === "string" && (
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground">Cost:</span>
								<span>{output.cost}</span>
							</div>
						)}
						{Array.isArray(output?.providers) && (output.providers as unknown[]).length > 0 && (
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground">Providers:</span>
								<span>
									{(output.providers as unknown[]).length} SP
									{(output.providers as unknown[]).length > 1 ? "s" : ""}
								</span>
							</div>
						)}
					</div>
				</ArtifactContent>
			)}

			{/* Rejected */}
			{hasOutput && outputStatus === "rejected" && (
				<ArtifactContent className="p-3">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<AlertCircle className="h-4 w-4" />
						Upload cancelled
					</div>
				</ArtifactContent>
			)}

			{/* Failed */}
			{hasOutput && outputStatus === "failed" && (
				<ArtifactContent className="p-3">
					<div className="flex items-center gap-2 text-sm text-red-500">
						<AlertCircle className="h-4 w-4" />
						Upload failed: {(output?.error ?? "Unknown error") as string}
					</div>
				</ArtifactContent>
			)}
		</Artifact>
	);
}

/** Upload plan card — shown when agent proposes a multi-step upload */
function _UploadPlanCard({
	data,
	isStreaming,
}: {
	data: Record<string, unknown>;
	isStreaming: boolean;
}) {
	const steps = (data.steps ?? []) as string[];
	const title = (data.title ?? "Upload Plan") as string;
	const description = (data.description ?? "") as string;

	return (
		<Plan isStreaming={isStreaming} defaultOpen>
			<PlanHeader>
				<div>
					<PlanTitle>{title}</PlanTitle>
					{description && <PlanDescription>{description}</PlanDescription>}
				</div>
				<PlanTrigger />
			</PlanHeader>
			<PlanContent>
				<ChainOfThought>
					<ChainOfThoughtHeader>Upload Steps</ChainOfThoughtHeader>
					<ChainOfThoughtContent>
						{steps.map((step, i) => (
							<ChainOfThoughtStep
								key={i}
								label={step}
								status={isStreaming && i === steps.length - 1 ? "active" : "complete"}
							/>
						))}
					</ChainOfThoughtContent>
				</ChainOfThought>
			</PlanContent>
		</Plan>
	);
}

/** Inline citation for doc references */
function _DocCitation({ url, title }: { url: string; title: string }) {
	return (
		<InlineCitation>
			<InlineCitationCard>
				<InlineCitationCardTrigger sources={[url]} />
				<InlineCitationCardBody>
					<InlineCitationSource title={title} url={url} description="W3S Documentation" />
				</InlineCitationCardBody>
			</InlineCitationCard>
		</InlineCitation>
	);
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

// ---------------------------------------------------------------------------
// Tool part renderer — artifact cards for known tools, generic fallback
// ---------------------------------------------------------------------------

function ToolPartRenderer({
	messageId,
	partIndex,
	toolPart,
	onApproveUpload,
	onRejectUpload,
}: {
	messageId: string;
	partIndex: number;
	toolPart: {
		type: string;
		state: string;
		toolCallId: string;
		input?: unknown;
		output?: unknown;
		errorText?: string;
		toolName?: string;
	};
	onApproveUpload: (toolCallId: string) => void;
	onRejectUpload: (toolCallId: string) => void;
}) {
	const toolName = toolPart.toolName ?? toolPart.type.replace("tool-", "");
	const output = toolPart.output as Record<string, unknown> | undefined;

	if (toolName === "uploadFile") {
		return (
			<UploadToolCard
				key={`${messageId}-${partIndex}`}
				toolPart={toolPart}
				onApprove={onApproveUpload}
				onReject={onRejectUpload}
			/>
		);
	}

	if (toolPart.state === "output-available" && output && !output.error) {
		if (toolName === "checkStatus") {
			return <FileStatusCard key={`${messageId}-${partIndex}`} data={output} />;
		}
		if (toolName === "listFiles") {
			return <FileListCard key={`${messageId}-${partIndex}`} data={output} />;
		}
	}

	return (
		<Tool key={`${messageId}-${partIndex}`} defaultOpen={toolPart.state === "output-available"}>
			<ToolHeader
				type={toolPart.type as "dynamic-tool"}
				state={
					toolPart.state as
						| "input-streaming"
						| "input-available"
						| "output-available"
						| "output-error"
				}
				toolName={toolName}
				title={toolName}
			/>
			<ToolContent>
				{toolPart.input != null && <ToolInput input={toolPart.input} />}
				{(toolPart.state === "output-available" || toolPart.state === "output-error") && (
					<ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
				)}
			</ToolContent>
		</Tool>
	);
}

// ---------------------------------------------------------------------------
// Main chat page
// ---------------------------------------------------------------------------

export default function ChatPage() {
	const [_text, setText] = useState("");
	const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
	const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
	const [uploadQueue, setUploadQueue] = useState<UploadQueueEntry[]>([]);
	const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0 });
	const { address } = useAccount();
	const { x402Fetch, isReady: x402Ready } = useX402();
	const x402FetchRef = useRef(x402Fetch);
	x402FetchRef.current = x402Fetch;
	const x402ReadyRef = useRef(x402Ready);
	x402ReadyRef.current = x402Ready;
	const selectedModelRef = useRef(selectedModel);
	selectedModelRef.current = selectedModel;
	const addressRef = useRef(address);
	addressRef.current = address;

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/chat",
				body: () => ({ model: selectedModelRef.current, wallet: addressRef.current }),
			}),
		[],
	);

	const { messages, status, sendMessage, stop, error, addToolResult } = useChat({
		transport,
		onToolCall: async ({ toolCall }) => {
			if (toolCall.toolName === "uploadFile") {
				const input = toolCall.input as Record<string, unknown>;
				const filename = (input.filename ?? "file") as string;
				// Find matching queued file by filename
				setUploadQueue((q) => {
					const match = q.find(
						(entry) => entry.filename === filename && entry.status === "pending",
					);
					if (match) {
						// Link this toolCallId to the queued file
						pendingFilesRef.current.set(toolCall.toolCallId, match.file);
						return q.map((entry) =>
							entry.id === match.id ? { ...entry, id: toolCall.toolCallId } : entry,
						);
					}
					return q;
				});
				// Don't auto-resolve — let the Confirmation UI handle it
			}
		},
		onFinish: (message) => {
			// Track token usage from response metadata
			const usage = (message as Record<string, unknown>).usage as
				| { inputTokens?: number; outputTokens?: number }
				| undefined;
			if (usage) {
				setTokenUsage((prev) => ({
					input: prev.input + (usage.inputTokens ?? 0),
					output: prev.output + (usage.outputTokens ?? 0),
				}));
			}
		},
	});

	const isStreaming = status === "streaming";
	const isBusy = isStreaming || status === "submitted";

	// Map toolCallId → queued file for actual upload on approval
	const pendingFilesRef = useRef<Map<string, File>>(new Map());
	// Mirror queue in a ref so callbacks always have access to file objects
	const uploadQueueRef = useRef<UploadQueueEntry[]>([]);
	uploadQueueRef.current = uploadQueue;

	const handleSubmit = useCallback(
		async (message: PromptInputMessage) => {
			const hasText = Boolean(message.text);
			const fileParts = message.files ?? [];
			const hasFiles = fileParts.length > 0;
			if (!(hasText || hasFiles)) return;

			if (hasFiles) {
				// Convert FileUIPart data URLs → real File objects for upload
				const realFiles = await Promise.all(
					fileParts.map(async (part) => {
						const res = await fetch(part.url);
						const blob = await res.blob();
						const name = part.filename ?? "untitled";
						return new File([blob], name, { type: part.mediaType });
					}),
				);

				const fileDescriptions = realFiles
					.map((f) => `${f.name} (${formatBytes(f.size)})`)
					.join(", ");

				// Queue files for upload — store actual File objects
				const newEntries: UploadQueueEntry[] = realFiles.map((f) => ({
					id: crypto.randomUUID(),
					filename: f.name,
					size: f.size,
					file: f,
					completed: false,
					status: "pending" as const,
				}));
				setUploadQueue((q) => [...q, ...newEntries]);

				// Tell the agent about the files via text only — don't send to LLM
				sendMessage({
					text: message.text
						? `${message.text}\n\nAttached files to upload: ${fileDescriptions}`
						: `Please upload these files: ${fileDescriptions}`,
				});
			} else {
				sendMessage({ text: message.text || "" });
			}
			setText("");
		},
		[sendMessage],
	);

	const handleApproveUpload = useCallback(
		async (toolCallId: string) => {
			// Try pendingFilesRef first, then fall back to the queue ref by id or pending status
			let file = pendingFilesRef.current.get(toolCallId);
			if (!file) {
				const entry =
					uploadQueueRef.current.find((e) => e.id === toolCallId) ??
					uploadQueueRef.current.find((e) => e.status === "pending" && e.file);
				file = entry?.file;
				// If found by pending status, update the entry id to match this toolCallId
				if (file && entry && entry.id !== toolCallId) {
					setUploadQueue((q) => q.map((e) => (e.id === entry.id ? { ...e, id: toolCallId } : e)));
				}
			}

			// Mark as uploading
			setUploadQueue((q) =>
				q.map((entry) =>
					entry.id === toolCallId ? { ...entry, status: "uploading" as const } : entry,
				),
			);

			if (!file) {
				addToolResult({
					toolCallId,
					tool: "uploadFile",
					output: {
						status: "failed",
						error: "File reference lost — please re-attach and try again.",
					},
				});
				setUploadQueue((q) =>
					q.map((entry) =>
						entry.id === toolCallId
							? { ...entry, completed: true, status: "failed" as const }
							: entry,
					),
				);
				return;
			}

			try {
				const formData = new FormData();
				formData.append("file", file);

				// Use x402Fetch if wallet is connected — handles 402 → sign → retry automatically
				const res = x402ReadyRef.current
					? await x402FetchRef.current("/upload", { method: "POST", body: formData })
					: await fetch(`${API_URL}/upload`, { method: "POST", body: formData });

				if (res.status === 402) {
					const paymentReq = await res.json().catch(() => null);
					const accepts = paymentReq?.accepts ?? paymentReq?.requirements;
					pendingFilesRef.current.delete(toolCallId);
					addToolResult({
						toolCallId,
						tool: "uploadFile",
						output: {
							status: "failed",
							error: `x402 payment required — connect a wallet to sign the payment.${
								accepts ? ` Cost: ${JSON.stringify(accepts[0]?.price ?? accepts)}` : ""
							}`,
						},
					});
					setUploadQueue((q) =>
						q.map((entry) =>
							entry.id === toolCallId
								? { ...entry, completed: true, status: "failed" as const }
								: entry,
						),
					);
					return;
				}

				if (!res.ok) {
					const errBody = await res.json().catch(() => ({ error: res.statusText }));
					throw new Error(
						((errBody as Record<string, unknown>)?.error as string) ??
							((errBody as Record<string, unknown>)?.message as string) ??
							`Upload failed (${res.status})`,
					);
				}

				const result = await res.json();

				pendingFilesRef.current.delete(toolCallId);
				addToolResult({
					toolCallId,
					tool: "uploadFile",
					output: {
						status: "approved",
						message: "Upload complete.",
						cid: result.cid,
						filename: file.name,
						size: file.size,
						...result,
					},
				});
				setUploadQueue((q) =>
					q.map((entry) =>
						entry.id === toolCallId
							? { ...entry, completed: true, status: "done" as const }
							: entry,
					),
				);
			} catch (err) {
				pendingFilesRef.current.delete(toolCallId);
				addToolResult({
					toolCallId,
					tool: "uploadFile",
					output: {
						status: "failed",
						error: err instanceof Error ? err.message : "Upload failed",
					},
				});
				setUploadQueue((q) =>
					q.map((entry) =>
						entry.id === toolCallId
							? { ...entry, completed: true, status: "failed" as const }
							: entry,
					),
				);
			}
		},
		[addToolResult],
	);

	const handleRejectUpload = useCallback(
		(toolCallId: string) => {
			addToolResult({
				toolCallId,
				tool: "uploadFile",
				output: {
					status: "rejected",
					message: "Upload cancelled by user.",
				},
			});
			setUploadQueue((q) =>
				q.map((entry) => (entry.id === toolCallId ? { ...entry, completed: true } : entry)),
			);
		},
		[addToolResult],
	);

	function handleSuggestion(text: string) {
		sendMessage({ text });
	}

	const currentModel = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];
	const pendingUploads = uploadQueue.filter((u) => !u.completed);
	const completedUploads = uploadQueue.filter((u) => u.completed);
	const totalTokens = tokenUsage.input + tokenUsage.output;

	return (
		<div className="flex h-[calc(100vh-8rem)] flex-col">
			{/* Header with context usage */}
			<div className="mb-4 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Chat with W3S Agent</h1>
				{totalTokens > 0 && (
					<Context
						usedTokens={totalTokens}
						maxTokens={128000}
						modelId={selectedModel}
						usage={
							{
								inputTokens: tokenUsage.input,
								outputTokens: tokenUsage.output,
								totalTokens: tokenUsage.input + tokenUsage.output,
								inputTokenDetails: {},
								outputTokenDetails: {},
							} as import("ai").LanguageModelUsage
						}
					>
						<ContextTrigger />
						<ContextContent>
							<ContextContentHeader />
							<ContextContentBody>
								<div className="space-y-1">
									<ContextInputUsage />
									<ContextOutputUsage />
								</div>
							</ContextContentBody>
							<ContextContentFooter />
						</ContextContent>
					</Context>
				)}
			</div>

			<div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card">
				{/* Upload queue sidebar — shown when uploads are pending */}
				{uploadQueue.length > 0 && (
					<div className="border-b border-border/50 px-4 py-2">
						<Queue>
							{pendingUploads.length > 0 && (
								<QueueSection defaultOpen>
									<QueueSectionTrigger>
										<QueueSectionLabel
											count={pendingUploads.length}
											label="pending"
											icon={<Clock className="h-3.5 w-3.5 text-yellow-500" />}
										/>
									</QueueSectionTrigger>
									<QueueSectionContent>
										<QueueList>
											{pendingUploads.map((entry) => (
												<QueueItem key={entry.id}>
													<div className="flex items-center gap-2">
														<QueueItemIndicator />
														<QueueItemContent>{entry.filename}</QueueItemContent>
													</div>
												</QueueItem>
											))}
										</QueueList>
									</QueueSectionContent>
								</QueueSection>
							)}
							{completedUploads.length > 0 && (
								<QueueSection defaultOpen={false}>
									<QueueSectionTrigger>
										<QueueSectionLabel
											count={completedUploads.length}
											label="completed"
											icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
										/>
									</QueueSectionTrigger>
									<QueueSectionContent>
										<QueueList>
											{completedUploads.map((entry) => (
												<QueueItem key={entry.id}>
													<div className="flex items-center gap-2">
														<QueueItemIndicator completed />
														<QueueItemContent completed>{entry.filename}</QueueItemContent>
													</div>
												</QueueItem>
											))}
										</QueueList>
									</QueueSectionContent>
								</QueueSection>
							)}
						</Queue>
					</div>
				)}

				{/* Messages */}
				<Conversation className="flex-1">
					<ConversationContent className="space-y-4 p-4">
						{messages.length === 0 && (
							<div className="flex h-full flex-col items-center justify-center gap-6 text-center">
								<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
									<Bot className="h-8 w-8 text-primary" />
								</div>
								<div>
									<h2 className="text-lg font-semibold">W3S Storage Agent</h2>
									<p className="mt-1 text-sm text-muted-foreground">
										Upload files, check status, or ask about integrating with your stack.
									</p>
								</div>
								<Suggestions>
									{suggestions.map((s) => (
										<Suggestion key={s} suggestion={s} onClick={handleSuggestion} />
									))}
								</Suggestions>
							</div>
						)}

						{messages.map((message, index) => (
							<Message
								key={message.id}
								from={message.role}
								className="animate-in fade-in slide-in-from-bottom-2 duration-300"
							>
								<MessageContent>
									{message.parts.map((part, i) => {
										switch (part.type) {
											case "text": {
												// Parse inline citations from text (format: [text](url))
												const citationRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
												const hasCitations = citationRegex.test(part.text);

												if (hasCitations) {
													const segments: React.ReactNode[] = [];
													let lastIndex = 0;
													citationRegex.lastIndex = 0;
													let match: RegExpExecArray | null;

													while ((match = citationRegex.exec(part.text)) !== null) {
														if (match.index > lastIndex) {
															segments.push(
																<span key={`t-${lastIndex}`}>
																	{part.text.slice(lastIndex, match.index)}
																</span>,
															);
														}
														segments.push(
															<InlineCitation key={`c-${match.index}`}>
																<InlineCitationText>{match[1]}</InlineCitationText>
																<InlineCitationCard>
																	<InlineCitationCardTrigger sources={[match[2]]} />
																	<InlineCitationCardBody>
																		<InlineCitationSource title={match[1]} url={match[2]} />
																	</InlineCitationCardBody>
																</InlineCitationCard>
															</InlineCitation>,
														);
														lastIndex = match.index + match[0].length;
													}
													if (lastIndex < part.text.length) {
														segments.push(
															<span key={`t-${lastIndex}`}>{part.text.slice(lastIndex)}</span>,
														);
													}

													return (
														<div key={`${message.id}-${i}`} className="text-sm">
															{segments}
														</div>
													);
												}

												return (
													<MessageResponse key={`${message.id}-${i}`}>{part.text}</MessageResponse>
												);
											}
											case "reasoning":
												return (
													<Reasoning
														key={`${message.id}-${i}`}
														isStreaming={
															(
																part as {
																	state?: string;
																}
															).state === "streaming"
														}
													>
														<ReasoningTrigger />
														<ReasoningContent>
															{
																(
																	part as {
																		text: string;
																	}
																).text
															}
														</ReasoningContent>
													</Reasoning>
												);
											default:
												if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
													return (
														<ToolPartRenderer
															key={`${message.id}-${i}`}
															messageId={message.id}
															partIndex={i}
															toolPart={
																part as {
																	type: string;
																	state: string;
																	toolCallId: string;
																	input?: unknown;
																	output?: unknown;
																	errorText?: string;
																	toolName?: string;
																}
															}
															onApproveUpload={handleApproveUpload}
															onRejectUpload={handleRejectUpload}
														/>
													);
												}
												return null;
										}
									})}
								</MessageContent>
								{message.role === "assistant" && index === messages.length - 1 && !isStreaming && (
									<MessageActions>
										<MessageAction
											tooltip="Copy"
											onClick={() => {
												const msgText = message.parts
													.filter(
														(
															p,
														): p is {
															type: "text";
															text: string;
														} => p.type === "text",
													)
													.map((p) => p.text)
													.join("");
												navigator.clipboard.writeText(msgText);
											}}
										>
											<Copy className="h-3.5 w-3.5" />
										</MessageAction>
									</MessageActions>
								)}
							</Message>
						))}

						{/* Shimmer loading indicator */}
						{isBusy && messages[messages.length - 1]?.role !== "assistant" && (
							<Message from="assistant">
								<MessageContent>
									<Shimmer>Thinking about your request...</Shimmer>
								</MessageContent>
							</Message>
						)}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				{/* Checkpoint — shown after conversation milestones */}
				{messages.length > 0 && messages.length % 10 === 0 && (
					<Checkpoint>
						<CheckpointIcon />
						<span className="shrink-0 px-2 text-xs">{messages.length} messages</span>
					</Checkpoint>
				)}

				{/* Input */}
				<div className="border-t border-border/50 bg-background p-4">
					<PromptInputProvider>
						<PromptInput onSubmit={handleSubmit} globalDrop multiple>
							<PromptInputAttachmentsDisplay />
							<PromptInputBody>
								<PromptInputTextarea placeholder="Ask the storage agent..." />
							</PromptInputBody>
							<PromptInputFooter>
								<PromptInputTools>
									<PromptInputActionMenu>
										<PromptInputActionMenuTrigger />
										<PromptInputActionMenuContent>
											<PromptInputActionAddAttachments />
										</PromptInputActionMenuContent>
									</PromptInputActionMenu>
									<ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
										<ModelSelectorTrigger render={<PromptInputButton />}>
											<ModelSelectorLogo provider={currentModel.provider} />
											<ModelSelectorName>{currentModel.name}</ModelSelectorName>
										</ModelSelectorTrigger>
										<ModelSelectorContent>
											<ModelSelectorInput placeholder="Search models..." />
											<ModelSelectorList>
												<ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
												<ModelSelectorGroup heading="Available Models">
													{MODELS.map((model) => (
														<ModelSelectorItem
															key={model.id}
															value={model.id}
															onSelect={() => {
																setSelectedModel(model.id);
																setModelSelectorOpen(false);
															}}
														>
															<ModelSelectorLogo provider={model.provider} />
															<ModelSelectorName>{model.name}</ModelSelectorName>
														</ModelSelectorItem>
													))}
												</ModelSelectorGroup>
											</ModelSelectorList>
										</ModelSelectorContent>
									</ModelSelector>
								</PromptInputTools>
								<PromptInputSubmit status={status} onStop={stop} />
							</PromptInputFooter>
						</PromptInput>
					</PromptInputProvider>
					{error && (
						<div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-400">
							{error.message}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
