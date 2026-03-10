import type { ConversationMessage, IntentResult } from "@w3stor/shared";
import { detectIntent } from "./agents/intent-agent";
import { createStorageAgentStream, type StorageAgentOptions } from "./agents/storage-agent";

export class W3StorOrchestrator {
	private model: StorageAgentOptions["model"];

	constructor(model: StorageAgentOptions["model"]) {
		this.model = model;
	}

	stream(options: Omit<StorageAgentOptions, "model">) {
		return createStorageAgentStream({ ...options, model: this.model });
	}

	async detectIntent(message: string, history: ConversationMessage[]): Promise<IntentResult> {
		return detectIntent(this.model, message, history);
	}
}
