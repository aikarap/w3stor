import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CarWriter } from "@ipld/car/writer";
import { importer, type WritableStorage } from "ipfs-unixfs-importer";
import { CID } from "multiformats/cid";

export interface CarFileResult {
	rootCid: string;
	carFilePath: string;
	carSize: number;
	totalSize: number;
}

function isAsyncIterable<T>(input: unknown): input is AsyncIterable<T> {
	return typeof input === "object" && input !== null && Symbol.asyncIterator in input;
}

function isIterable<T>(input: unknown): input is Iterable<T> {
	return typeof input === "object" && input !== null && Symbol.iterator in input;
}

async function collectBytes(
	data: Uint8Array | AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): Promise<Uint8Array> {
	if (data instanceof Uint8Array) {
		return data;
	}

	const chunks: Uint8Array[] = [];
	if (isAsyncIterable<Uint8Array>(data)) {
		for await (const chunk of data) {
			chunks.push(chunk);
		}
	} else if (isIterable<Uint8Array>(data)) {
		for (const chunk of data) {
			chunks.push(chunk);
		}
	}

	const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const buffer = new Uint8Array(totalSize);
	let offset = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return buffer;
}

export class MemoryBlockstore {
	private readonly blocks = new Map<string, Uint8Array>();

	async put(cid: CID, bytes: Uint8Array | AsyncIterable<Uint8Array> | Iterable<Uint8Array>) {
		const normalized = await collectBytes(bytes);
		this.blocks.set(cid.toString(), normalized);
	}

	async get(cid: CID) {
		const block = this.blocks.get(cid.toString());
		if (!block) {
			throw new Error(`Missing block for CID ${cid.toString()}`);
		}
		return block;
	}

	async *entries() {
		for (const [key, bytes] of this.blocks.entries()) {
			yield { cid: CID.parse(key), bytes };
		}
	}

	async has(cid: CID) {
		return this.blocks.has(cid.toString());
	}

	clear() {
		this.blocks.clear();
	}
}

export async function* iterateFileContent(
	data: Uint8Array,
	filename: string,
): AsyncGenerator<{ path: string; content: AsyncIterable<Uint8Array> }> {
	async function* yieldChunks(bytes: Uint8Array): AsyncIterable<Uint8Array> {
		yield bytes;
	}

	yield {
		path: filename,
		content: yieldChunks(data),
	};
}

async function writeCarToFile(
	blockstore: MemoryBlockstore,
	rootCid: CID,
	filePath: string,
): Promise<number> {
	const { writer, out } = await CarWriter.create([rootCid]);

	const writeStream = createWriteStream(filePath);
	let carSize = 0;

	const writeOutput = (async () => {
		for await (const chunk of out) {
			carSize += chunk.byteLength;
			const ok = writeStream.write(chunk);
			if (!ok) {
				await new Promise<void>((resolve) => writeStream.once("drain", resolve));
			}
		}
		await new Promise<void>((resolve, reject) => {
			writeStream.end((err: Error | null) => (err ? reject(err) : resolve()));
		});
	})();

	for await (const { cid, bytes } of blockstore.entries()) {
		await writer.put({ cid, bytes });
	}
	await writer.close();
	await writeOutput;

	return carSize;
}

/**
 * Build a CAR file from raw file data and write it to a temp file on disk.
 * Avoids buffering the entire CAR in memory by streaming CarWriter output to disk.
 *
 * @param fileData - Raw file bytes
 * @param filename - Name of the file (used in the UnixFS metadata)
 * @returns Root CID, temp file path, CAR size, and original file size
 */
export async function buildCarToFile(
	fileData: Uint8Array,
	filename: string = "file",
): Promise<CarFileResult> {
	const blockstore = new MemoryBlockstore();
	let rootCid: CID | null = null;

	for await (const entry of importer(
		iterateFileContent(fileData, filename),
		blockstore as unknown as WritableStorage,
		{
			cidVersion: 1,
			wrapWithDirectory: false,
			rawLeaves: true,
		},
	)) {
		rootCid = entry.cid;
	}

	if (!rootCid) {
		throw new Error("Failed to determine CAR root CID");
	}

	const carFilePath = join(tmpdir(), `car-${crypto.randomUUID()}.car`);
	const carSize = await writeCarToFile(blockstore, rootCid, carFilePath);

	blockstore.clear();

	return {
		rootCid: rootCid.toString(),
		carFilePath,
		carSize,
		totalSize: fileData.length,
	};
}

/**
 * Remove a temp CAR file. Safe to call if the file doesn't exist.
 */
export async function cleanupCarFile(filePath: string): Promise<void> {
	try {
		await unlink(filePath);
	} catch {
		// File may already be cleaned up
	}
}
