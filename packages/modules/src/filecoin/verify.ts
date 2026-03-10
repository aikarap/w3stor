import * as Piece from "@filoz/synapse-core/piece";
import * as SP from "@filoz/synapse-core/sp";
import {
	VerificationNetworkError,
	VerificationNotFoundError,
	VerificationValidationError,
} from "@w3stor/shared";
import type { Address } from "viem";
import type { FilecoinVerifyResult } from "./types";

export async function verifyFilecoinFile(
	pieceCid: string,
	providerEndpoint: string,
	providerAddress: Address,
): Promise<FilecoinVerifyResult> {
	let parsedPieceCid: ReturnType<typeof Piece.parse>;
	try {
		parsedPieceCid = Piece.parse(pieceCid);
	} catch {
		throw new VerificationValidationError("Invalid piece CID format", {
			pieceCid,
		});
	}

	try {
		await SP.findPiece({
			serviceURL: providerEndpoint,
			pieceCid: parsedPieceCid,
		});

		const pieceUrl = `${providerEndpoint}/piece/${pieceCid}`;
		const response = await fetch(pieceUrl);

		if (!response.ok) {
			throw new VerificationValidationError(`Failed to download piece: ${response.statusText}`, {
				provider: providerAddress,
				pieceCid,
				status: response.status,
			});
		}

		const data = await Piece.downloadAndValidate({
			url: pieceUrl,
			expectedPieceCid: parsedPieceCid,
		});
		const calculatedCid = Piece.calculate(data);
		const verified = calculatedCid.toString() === pieceCid;

		return {
			exists: true,
			pieceCid,
			provider: providerAddress,
			retrievalUrl: pieceUrl,
			verified,
		};
	} catch (error) {
		if (error instanceof VerificationValidationError) {
			throw error;
		}

		const errorMessage = error instanceof Error ? error.message : String(error);

		if (
			errorMessage.includes("ECONNREFUSED") ||
			errorMessage.includes("timeout") ||
			errorMessage.includes("ETIMEDOUT")
		) {
			throw new VerificationNetworkError("Network error contacting provider", {
				provider: providerAddress,
				endpoint: providerEndpoint,
				error: errorMessage,
			});
		}

		if (
			errorMessage.includes("404") ||
			errorMessage.includes("not found") ||
			errorMessage.includes("Not Found")
		) {
			throw new VerificationNotFoundError("Piece not found on provider", {
				provider: providerAddress,
				pieceCid,
			});
		}

		throw new VerificationValidationError("Verification failed", {
			provider: providerAddress,
			pieceCid,
			error: errorMessage,
		});
	}
}
