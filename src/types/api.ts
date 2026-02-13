export interface UploadResponse {
	cid: string;
	status: string;
	size: number;
	filename: string;
}

export interface FileListResponse {
	files: FileInfo[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

export interface FileInfo {
	cid: string;
	filename: string;
	size: number;
	status: string;
	createdAt: string;
	spCount: number;
	metadata?: Record<string, unknown>;
}

export interface StatusResponse {
	cid: string;
	status: string;
	pinataStatus: boolean;
	filecoinStatus: Record<string, string | null>;
	verifiedSPs: number;
	createdAt: string;
}

export interface HealthResponse {
	status: "healthy" | "unhealthy";
	timestamp: string;
	services: {
		database: boolean;
		redis: boolean;
		pinata: boolean;
	};
}

export interface ErrorResponse {
	error: string;
	message: string;
	statusCode: number;
	context?: Record<string, unknown>;
}
