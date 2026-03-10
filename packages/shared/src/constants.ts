// Pure literal constants only — no imports, no config dependencies

export const API_PAGINATION = {
	DEFAULT_PAGE: 1,
	DEFAULT_LIMIT: 20,
	MAX_LIMIT: 100,
} as const;

export const API_STATUS_CODES = {
	OK: 200,
	CREATED: 201,
	NOT_FOUND: 404,
	SERVICE_UNAVAILABLE: 503,
} as const;

export const FILECOIN_IPNI_INDEXER_URL = "https://filecoinpin.contact";

export const X402_CONSTANTS = {
	MAX_TIMEOUT_SECONDS: 3600,
	TOKEN_DECIMALS_MULTIPLIER: 10,
} as const;

export const WORKER_QUEUE_NAME = "filecoin-operations";
