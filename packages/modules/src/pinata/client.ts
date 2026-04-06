import { config, logger, PinataError } from "@w3stor/shared";

const PINATA_API_BASE = "https://api.pinata.cloud";

interface PinataResponse {
	IpfsHash: string;
	PinSize: number;
	Timestamp: string;
	isDuplicate?: boolean;
}

export async function pinFileToIPFS(file: Blob, filename?: string): Promise<PinataResponse> {
	const formData = new FormData();
	formData.append("file", file, filename || "file");
	formData.append(
		"pinataOptions",
		JSON.stringify({
			cidVersion: 1,
		}),
	);

	try {
		// 5 minute timeout — prevents holding upload buffers indefinitely if Pinata is slow
		const response = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.pinata.jwt}`,
			},
			body: formData,
			signal: AbortSignal.timeout(5 * 60 * 1000),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new PinataError("Pinata pin failed", {
				status: response.status,
				error: errorText,
			});
		}

		const data = (await response.json()) as PinataResponse;

		logger.info("File pinned to Pinata", {
			cid: data.IpfsHash,
			size: data.PinSize,
			isDuplicate: data.isDuplicate,
		});

		return data;
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}

		logger.error("Pinata pin request failed", {
			error: error instanceof Error ? error.message : String(error),
		});

		throw new PinataError("Failed to pin file to IPFS");
	}
}

export async function unpinFile(cid: string): Promise<void> {
	try {
		const response = await fetch(`${PINATA_API_BASE}/pinning/unpin/${cid}`, {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${config.pinata.jwt}`,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new PinataError("Pinata unpin failed", {
				status: response.status,
				error: errorText,
			});
		}

		logger.info("File unpinned from Pinata", { cid });
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}

		logger.error("Pinata unpin request failed", {
			cid,
			error: error instanceof Error ? error.message : String(error),
		});

		throw new PinataError("Failed to unpin file from IPFS");
	}
}

interface IPFSGateway {
	name: string;
	url: string;
	headers: Record<string, string>;
	retries: number;
	maxConcurrent: number;
}

/**
 * Per-gateway concurrency limiter.
 * Each gateway has its own semaphore so rate limits on one don't block others.
 */
class GatewaySemaphore {
	private active = 0;
	private queue: Array<() => void> = [];

	constructor(private readonly max: number) {}

	async acquire(): Promise<void> {
		if (this.active < this.max) {
			this.active++;
			return;
		}
		await new Promise<void>((resolve) => this.queue.push(resolve));
		this.active++;
	}

	release(): void {
		this.active--;
		const next = this.queue.shift();
		if (next) next();
	}
}

// Persistent semaphores per gateway — shared across all fetch calls in this process
const gatewaySemaphores: Record<string, GatewaySemaphore> = {};

function getSemaphore(name: string, maxConcurrent: number): GatewaySemaphore {
	if (!gatewaySemaphores[name]) {
		gatewaySemaphores[name] = new GatewaySemaphore(maxConcurrent);
	}
	return gatewaySemaphores[name];
}

function getGateways(cid: string): IPFSGateway[] {
	const gatewayUrl = config.pinata.gatewayUrl.replace(/\/$/, "");
	const gatewayToken = config.pinata.gatewayToken;

	// Personal gateway first — dedicated, highest limit.
	// Public Pinata second — shared, rate-limited (429s).
	// ipfs.io last resort — slow but no auth needed.
	return [
		{
			name: "personal-pinata",
			url: gatewayToken
				? `${gatewayUrl}/ipfs/${cid}?pinataGatewayToken=${gatewayToken}`
				: `${gatewayUrl}/ipfs/${cid}`,
			headers: !gatewayToken ? { Authorization: `Bearer ${config.pinata.jwt}` } : {},
			retries: 2,
			maxConcurrent: 4,
		},
		{
			name: "public-pinata",
			url: `https://gateway.pinata.cloud/ipfs/${cid}`,
			headers: {},
			retries: 2,
			maxConcurrent: 2,
		},
		{
			name: "ipfs-io",
			url: `https://ipfs.io/ipfs/${cid}`,
			headers: {},
			retries: 1,
			maxConcurrent: 2,
		},
	];
}

/**
 * Fetch file from IPFS as a stream — avoids buffering entire file in memory.
 * Returns the Response object so the caller can consume the body stream.
 */
export async function fetchFromIPFSStream(cid: string): Promise<{ stream: ReadableStream<Uint8Array>; sizeBytes: number }> {
	const gateways = getGateways(cid);

	for (const gateway of gateways) {
		const semaphore = getSemaphore(gateway.name, gateway.maxConcurrent);

		for (let attempt = 1; attempt <= gateway.retries; attempt++) {
			await semaphore.acquire();
			try {
				logger.info("Fetching from IPFS gateway", {
					cid,
					gateway: gateway.name,
					attempt,
					maxAttempts: gateway.retries,
				});

				const response = await fetch(gateway.url, { headers: gateway.headers });

				if (!response.ok) {
					semaphore.release();
					logger.warn("IPFS gateway returned error", {
						cid,
						gateway: gateway.name,
						attempt,
						status: response.status,
					});
					continue;
				}

				if (!response.body) {
					semaphore.release();
					logger.warn("IPFS gateway returned no body stream", {
						cid,
						gateway: gateway.name,
						attempt,
					});
					continue;
				}

				const contentLength = response.headers.get("content-length");
				const sizeBytes = contentLength ? parseInt(contentLength, 10) : 0;

				logger.info("IPFS gateway stream opened", {
					cid,
					gateway: gateway.name,
					attempt,
					sizeBytes,
				});

				// Release semaphore now — the rate limit is on connection initiation,
				// not on transfer duration. The stream will be consumed by the caller.
				semaphore.release();

				return { stream: response.body, sizeBytes };
			} catch (error) {
				semaphore.release();
				logger.warn("IPFS gateway fetch attempt failed", {
					cid,
					gateway: gateway.name,
					attempt,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	throw new PinataError("All IPFS gateways failed", { cid });
}

export async function fetchFromIPFS(cid: string): Promise<Uint8Array> {
	const gateways = getGateways(cid);

	for (const gateway of gateways) {
		const semaphore = getSemaphore(gateway.name, gateway.maxConcurrent);

		for (let attempt = 1; attempt <= gateway.retries; attempt++) {
			await semaphore.acquire();
			try {
				logger.info("Fetching from IPFS gateway", {
					cid,
					gateway: gateway.name,
					attempt,
					maxAttempts: gateway.retries,
				});

				const response = await fetch(gateway.url, { headers: gateway.headers });

				if (!response.ok) {
					logger.warn("IPFS gateway returned error", {
						cid,
						gateway: gateway.name,
						attempt,
						status: response.status,
					});
					continue;
				}

				const arrayBuffer = await response.arrayBuffer();

				logger.info("File fetched from IPFS gateway", {
					cid,
					gateway: gateway.name,
					attempt,
					sizeBytes: arrayBuffer.byteLength,
				});

				return new Uint8Array(arrayBuffer);
			} catch (error) {
				logger.warn("IPFS gateway fetch attempt failed", {
					cid,
					gateway: gateway.name,
					attempt,
					error: error instanceof Error ? error.message : String(error),
				});
			} finally {
				semaphore.release();
			}
		}
	}

	throw new PinataError("All IPFS gateways failed", { cid });
}

export async function checkPinataHealth(): Promise<boolean> {
	try {
		const response = await fetch(`${PINATA_API_BASE}/data/testAuthentication`, {
			headers: {
				Authorization: `Bearer ${config.pinata.jwt}`,
			},
		});

		return response.ok;
	} catch (error) {
		logger.error("Pinata health check failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}
