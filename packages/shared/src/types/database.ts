export type FileStatus = "pinata_pinned" | "uploading" | "stored" | "fully_replicated" | "failed";

export type SPStatus = "pending" | "uploading" | "stored" | "verified" | "failed";

export type ConversationState = "active" | "waiting_input" | "storing" | "completed" | "failed";

export type SessionType = "a2a" | "mcp" | "http";

export interface User {
	wallet_address: string;
	created_at: Date;
	updated_at: Date;
}

export interface File {
	cid: string;
	piece_cid: string | null;
	size_bytes: number;
	content_type: string | null;
	status: FileStatus;
	pinata_pinned: boolean;
	pinata_pin_id: string | null;
	created_at: Date;
	updated_at: Date;
}

export interface UserFile {
	id: string;
	wallet_address: string;
	cid: string;
	filename: string | null;
	metadata: Record<string, unknown>;
	created_at: Date;
	updated_at: Date;
}

export interface FileSPStatus {
	id: string;
	cid: string;
	sp_id: string;
	status: SPStatus;
	url: string | null;
	piece_cid: string | null;
	verified_at: Date | null;
	created_at: Date;
	updated_at: Date;
}

export interface Conversation {
	id: string;
	context_id: string;
	wallet_address: string | null;
	session_type: SessionType;
	state: ConversationState;
	detected_intent: string | null;
	intent_confidence: number | null;
	collected_params: Record<string, unknown>;
	messages: ConversationMessage[];
	created_at: Date;
	updated_at: Date;
}

export interface ConversationMessage {
	role: "user" | "agent";
	content: string;
	timestamp: string;
}
