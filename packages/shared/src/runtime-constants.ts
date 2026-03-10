import { config } from "./config";

export const SERVER = {
	getInternalUrl: (path: string) => `http://${config.host}:${config.port}${path}`,
	getPublicUrl: (path: string) => `${config.publicUrl}${path}`,
} as const;

export const FILECOIN_CONFIG = {
	get ADVERTISEMENT_WAIT() {
		return {
			DELAY_MS: config.filecoin.advertisementWaitDelay,
			MAX_ATTEMPTS: config.filecoin.advertisementWaitMaxAttempts,
		};
	},
	get REPLICATION() {
		return {
			MIN_PROVIDERS: config.filecoin.replicationMinProviders,
			TOTAL_PROVIDERS: config.filecoin.replicationTotalProviders,
		};
	},
} as const;

export const WORKER_JOB_DEFAULTS = {
	get MAX_ATTEMPTS() {
		return config.worker.maxAttempts;
	},
	get BACKOFF_DELAY_MS() {
		return config.worker.backoffDelay;
	},
	REMOVE_ON_COMPLETE_AGE_SECONDS: 86400,
	REMOVE_ON_COMPLETE_COUNT: 1000,
	REMOVE_ON_FAIL_AGE_SECONDS: 172800,
} as const;

export const API_REQUEST = {
	get SIZE_LIMIT() {
		return config.server.requestSizeLimit;
	},
} as const;
