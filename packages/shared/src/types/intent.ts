export type Intent = "store" | "retrieve" | "list" | "status" | "attest" | "conversation";

export interface IntentResult {
	intent: Intent;
	confidence: number;
	extractedParams: Record<string, unknown>;
	reasoning: string;
}

export interface ParamStatus {
	complete: boolean;
	missing: string[];
	collected: Record<string, unknown>;
	nextPrompt: string;
}
