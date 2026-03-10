import { calculateOperationPrice } from "./pricing";

export function calculateUploadCost(sizeBytes: number, network?: string, token?: string): number {
	return calculateOperationPrice("upload", sizeBytes, network, token);
}
