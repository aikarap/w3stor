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
		const response = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.pinata.jwt}`,
			},
			body: formData,
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

export async function fetchFromIPFS(cid: string): Promise<Uint8Array> {
	const gatewayUrl = config.pinata.gatewayUrl.replace(/\/$/, "");

	try {
		const response = await fetch(`${gatewayUrl}/ipfs/${cid}`, {
			headers: {
				Authorization: `Bearer ${config.pinata.jwt}`,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new PinataError("Pinata gateway fetch failed", {
				status: response.status,
				error: errorText,
			});
		}

		const arrayBuffer = await response.arrayBuffer();

		logger.info("File fetched from IPFS gateway", {
			cid,
			sizeBytes: arrayBuffer.byteLength,
		});

		return new Uint8Array(arrayBuffer);
	} catch (error) {
		if (error instanceof PinataError) {
			throw error;
		}

		logger.error("Pinata gateway fetch failed", {
			cid,
			error: error instanceof Error ? error.message : String(error),
		});

		throw new PinataError("Failed to fetch file from IPFS");
	}
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
