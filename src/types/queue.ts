export interface FilecoinUploadJob {
	cid: string;
	sizeBytes: number;
	walletAddress: string;
	pinataCid: string;
	filename: string;
}

export interface RetrievalVerifyJob {
	cid: string;
	spId: string;
	spUrl: string;
}

export interface PinataUnpinJob {
	cid: string;
	pinataPinId: string;
}

export type JobPayload = FilecoinUploadJob | RetrievalVerifyJob | PinataUnpinJob;
