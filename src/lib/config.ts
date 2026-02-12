type Environment = "development" | "production" | "test";

interface Config {
	env: Environment;
	port: number;
	host: string;
	publicUrl: string;
	logLevel: string;
	database: {
		url: string;
		maxConnections: number;
		idleTimeout: number;
		connectTimeout: number;
	};
	redis: {
		url: string;
	};
	pinata: {
		apiKey: string;
		apiSecret: string;
		jwt: string;
		gatewayUrl: string;
	};
	x402: {
		evmPrivateKey?: string;
		evmPayToAddress?: string;
		networks: X402NetworkConfig[];
	};
	filecoin: {
		advertisementWaitDelay: number;
		advertisementWaitMaxAttempts: number;
		replicationMinProviders: number;
		replicationTotalProviders: number;
	};
	worker: {
		concurrency: number;
		rateLimitMax: number;
		rateLimitDuration: number;
		maxAttempts: number;
		backoffDelay: number;
		shutdownTimeout: number;
	};
	rateLimiting: {
		maxMessagesPerConversation: number;
		maxConversationsPerWallet: number;
		idleTimeoutMs: number;
		cleanupIntervalMs: number;
	};
	server: {
		requestSizeLimit: string;
		shutdownTimeout: number;
		corsOrigin: string;
		rateLimitWindowMs: number;
		rateLimitMax: number;
	};
	ai: {
		defaultModel: string;
	};
}

export interface X402NetworkConfig {
	network: string;
	chainId: number;
	payTo: string;
	tokens: X402TokenConfig[];
}

export interface X402TokenConfig {
	symbol: string;
	address: string;
	decimals: number;
}

function getEnv(key: string, defaultValue?: string): string {
	const value = process.env[key] || defaultValue;
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
	return process.env[key] || defaultValue;
}

const port = parseInt(getOptionalEnv("PORT", "4000") || "4000", 10);
const host = getOptionalEnv("HOST", "localhost") || "localhost";
const publicUrl =
	getOptionalEnv("PUBLIC_URL", `http://${host}:${port}`) || `http://${host}:${port}`;

export const config: Config = {
	env: getOptionalEnv("NODE_ENV", "development") as Environment,
	port,
	host,
	publicUrl,
	logLevel: getOptionalEnv("LOG_LEVEL", "info") || "info",

	database: {
		url: getEnv("DATABASE_URL"),
		maxConnections: parseInt(getOptionalEnv("DATABASE_MAX_CONNECTIONS", "10") || "10", 10),
		idleTimeout: parseInt(getOptionalEnv("DATABASE_IDLE_TIMEOUT", "20") || "20", 10),
		connectTimeout: parseInt(getOptionalEnv("DATABASE_CONNECT_TIMEOUT", "10") || "10", 10),
	},

	redis: {
		url: getEnv("REDIS_URL"),
	},

	pinata: {
		apiKey: getEnv("PINATA_API_KEY"),
		apiSecret: getEnv("PINATA_API_SECRET"),
		jwt: getEnv("PINATA_JWT"),
		gatewayUrl:
			getOptionalEnv("PINATA_GATEWAY_URL", "https://gateway.pinata.cloud") ||
			"https://gateway.pinata.cloud",
	},

	x402: {
		evmPrivateKey: getOptionalEnv("X402_EVM_PRIVATE_KEY"),
		evmPayToAddress: getOptionalEnv("X402_EVM_PAY_TO"),
		networks: [], // Loaded by @w3stor/modules/x402 via loadX402Networks()
	},

	filecoin: {
		advertisementWaitDelay: parseInt(
			getOptionalEnv("FILECOIN_AD_WAIT_DELAY", "5000") || "5000",
			10,
		),
		advertisementWaitMaxAttempts: parseInt(
			getOptionalEnv("FILECOIN_AD_WAIT_MAX_ATTEMPTS", "20") || "20",
			10,
		),
		replicationMinProviders: parseInt(getOptionalEnv("FILECOIN_REPLICATION_MIN", "2") || "2", 10),
		replicationTotalProviders: parseInt(
			getOptionalEnv("FILECOIN_REPLICATION_TOTAL", "4") || "4",
			10,
		),
	},

	worker: {
		concurrency: parseInt(getOptionalEnv("WORKER_CONCURRENCY", "2") || "2", 10),
		rateLimitMax: parseInt(getOptionalEnv("WORKER_RATE_LIMIT_MAX", "5") || "5", 10),
		rateLimitDuration: parseInt(getOptionalEnv("WORKER_RATE_LIMIT_DURATION", "1000") || "1000", 10),
		maxAttempts: parseInt(getOptionalEnv("WORKER_MAX_ATTEMPTS", "3") || "3", 10),
		backoffDelay: parseInt(getOptionalEnv("WORKER_BACKOFF_DELAY", "2000") || "2000", 10),
		shutdownTimeout: parseInt(getOptionalEnv("WORKER_SHUTDOWN_TIMEOUT", "30000") || "30000", 10),
	},

	rateLimiting: {
		maxMessagesPerConversation: parseInt(
			getOptionalEnv("RATE_LIMIT_MAX_MESSAGES", "50") || "50",
			10,
		),
		maxConversationsPerWallet: parseInt(
			getOptionalEnv("RATE_LIMIT_MAX_CONVERSATIONS", "10") || "10",
			10,
		),
		idleTimeoutMs: parseInt(
			getOptionalEnv("RATE_LIMIT_IDLE_TIMEOUT_MS", "3600000") || "3600000",
			10,
		),
		cleanupIntervalMs: parseInt(
			getOptionalEnv("RATE_LIMIT_CLEANUP_INTERVAL_MS", "300000") || "300000",
			10,
		),
	},

	server: {
		requestSizeLimit: getOptionalEnv("REQUEST_SIZE_LIMIT", "100mb") || "100mb",
		shutdownTimeout: parseInt(getOptionalEnv("SERVER_SHUTDOWN_TIMEOUT", "30000") || "30000", 10),
		corsOrigin: getOptionalEnv("CORS_ORIGIN", "*") || "*",
		rateLimitWindowMs: parseInt(
			getOptionalEnv("HTTP_RATE_LIMIT_WINDOW_MS", "60000") || "60000",
			10,
		),
		rateLimitMax: parseInt(getOptionalEnv("HTTP_RATE_LIMIT_MAX", "100") || "100", 10),
	},

	ai: {
		defaultModel: getOptionalEnv("AI_DEFAULT_MODEL") ?? "openai/gpt-4o-mini",
	},
};

export function validateConfig(): void {
	const required = [
		"DATABASE_URL",
		"REDIS_URL",
		"PINATA_API_KEY",
		"PINATA_API_SECRET",
		"PINATA_JWT",
	];

	const missing = required.filter((key) => !process.env[key]);
	if (missing.length > 0) {
		throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
	}
}
