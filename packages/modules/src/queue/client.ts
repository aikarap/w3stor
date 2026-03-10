import type { JobPayload } from "@w3stor/shared";
import { config, logger, WORKER_JOB_DEFAULTS, WORKER_QUEUE_NAME } from "@w3stor/shared";
import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | null = null;
let workerConnection: IORedis | null = null;
let filecoinQueue: Queue<JobPayload> | null = null;

export function getRedisConnection(): IORedis {
	if (!connection) {
		connection = new IORedis(config.redis.url, {
			maxRetriesPerRequest: null, // BullMQ requires null for blocking commands
		});

		connection.on("error", (error) => {
			logger.error("Redis connection error", {
				error: error.message,
			});
		});

		logger.info("Redis connection established");
	}

	return connection;
}

export function getWorkerRedisConnection(): IORedis {
	if (!workerConnection) {
		workerConnection = new IORedis(config.redis.url, {
			maxRetriesPerRequest: null,
		});

		workerConnection.on("error", (error) => {
			logger.error("Redis worker connection error", {
				error: error.message,
			});
		});

		logger.info("Redis worker connection established");
	}

	return workerConnection;
}

export function getFilecoinQueue(): Queue<JobPayload> {
	if (!filecoinQueue) {
		const redis = getRedisConnection();

		filecoinQueue = new Queue(WORKER_QUEUE_NAME, {
			connection: redis.options,
			defaultJobOptions: {
				attempts: WORKER_JOB_DEFAULTS.MAX_ATTEMPTS,
				backoff: {
					type: "exponential",
					delay: WORKER_JOB_DEFAULTS.BACKOFF_DELAY_MS,
				},
				removeOnComplete: {
					age: WORKER_JOB_DEFAULTS.REMOVE_ON_COMPLETE_AGE_SECONDS,
					count: WORKER_JOB_DEFAULTS.REMOVE_ON_COMPLETE_COUNT,
				},
				removeOnFail: {
					age: WORKER_JOB_DEFAULTS.REMOVE_ON_FAIL_AGE_SECONDS,
				},
			},
		});

		logger.info("Filecoin queue initialized");
	}

	return filecoinQueue;
}

export async function closeQueueConnections(): Promise<void> {
	if (filecoinQueue) {
		await filecoinQueue.close();
		filecoinQueue = null;
	}

	if (workerConnection) {
		await workerConnection.quit();
		workerConnection = null;
	}

	if (connection) {
		await connection.quit();
		connection = null;
	}

	logger.info("Queue connections closed");
}

export async function healthCheck(): Promise<boolean> {
	try {
		const redis = getRedisConnection();
		const pong = await redis.ping();
		return pong === "PONG";
	} catch (error) {
		logger.error("Queue health check failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}
