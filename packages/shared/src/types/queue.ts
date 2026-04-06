export interface FilecoinUploadJob {
	cid: string;
	sizeBytes: number;
	walletAddress: string;
	pinataCid: string;
	filename: string;
	/** True when enqueued by auto-repair — used for semaphore + skip SSE */
	isRepair?: boolean;
}

export interface PinataUnpinJob {
	cid: string;
	pinataPinId: string;
}

export type JobPayload = FilecoinUploadJob | PinataUnpinJob;
