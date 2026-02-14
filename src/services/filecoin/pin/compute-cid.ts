import { importer, type WritableStorage } from "ipfs-unixfs-importer";
import { iterateFileContent, MemoryBlockstore } from "./car-builder";

/**
 * Compute the UnixFS root CID for raw file data without building a CAR.
 * Uses the same importer config as buildCarToFile() to guarantee CID consistency:
 * cidVersion: 1, wrapWithDirectory: false, rawLeaves: true.
 */
export async function computeRootCid(
	fileData: Uint8Array,
	filename: string = "file",
): Promise<string> {
	const blockstore = new MemoryBlockstore();
	let rootCid: string | null = null;

	for await (const entry of importer(
		iterateFileContent(fileData, filename),
		blockstore as unknown as WritableStorage,
		{
			cidVersion: 1,
			wrapWithDirectory: false,
			rawLeaves: true,
		},
	)) {
		rootCid = entry.cid.toString();
	}

	blockstore.clear();

	if (!rootCid) {
		throw new Error("Failed to compute root CID from file data");
	}

	return rootCid;
}
