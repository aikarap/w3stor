import type { Address, Hex } from "viem";

export interface FilecoinUploadResult {
	pieceCid: string;
	size: number;
	dataSetId: bigint;
	provider: {
		id: bigint;
		address: Address;
		endpoint: string;
	};
	txHash: Hex;
}

export interface FilecoinUploadOptions {
	metadata?: {
		name: string;
		type?: string;
	};
	providerId: bigint;
	forceNewDataSet?: boolean;
	onProgress?: (stage: UploadStage, details?: Record<string, unknown>) => void;
}

export type UploadStage =
	| "provider_selected"
	| "calculating_piece_cid"
	| "uploading_to_sp"
	| "piece_parked"
	| "creating_dataset"
	| "adding_pieces"
	| "tx_submitted"
	| "tx_confirmed"
	| "completed";

export interface FilecoinDownloadOptions {
	providerEndpoint?: string;
	verify?: boolean;
}

export interface FilecoinVerifyResult {
	exists: boolean;
	pieceCid: string;
	provider: Address;
	retrievalUrl: string;
	verified: boolean;
}
