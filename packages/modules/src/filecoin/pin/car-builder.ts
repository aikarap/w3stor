import { createWriteStream, createReadStream } from "node:fs";
import { unlink, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { CarWriter } from "@ipld/car/writer";
import { importer, type WritableStorage } from "ipfs-unixfs-importer";
import { CID } from "multiformats/cid";

export interface CarFileResult {
	rootCid: string;
	carFilePath: string;
	carSize: number;
	totalSize: number;
}

/**
 * Disk-backed blockstore that writes IPLD blocks to individual files on disk
 * instead of holding them all in memory. This allows processing files larger
 * than available RAM.
 */
export class DiskBlockstore {
	private readonly dir: string;
	private readonly index: Map<string, string> = new Map(); // cid -> filename

	constructor(dir: string) {
		this.dir = dir;
	}

	static async create(): Promise<DiskBlockstore> {
		const dir = join(tmpdir(), `blockstore-${crypto.randomUUID()}`);
		await mkdir(dir, { recursive: true });
		return new DiskBlockstore(dir);
	}

	async put(cid: CID, bytes: Uint8Array | AsyncIterable<Uint8Array> | Iterable<Uint8Array>) {
		const normalized = await collectBytes(bytes);
		const filename = `${cid.toString()}.block`;
		const filePath = join(this.dir, filename);
		await writeFile(filePath, normalized);
		this.index.set(cid.toString(), filename);
	}

	async get(cid: CID): Promise<Uint8Array> {
		const filename = this.index.get(cid.toString());
		if (!filename) {
			throw new Error(`Missing block for CID ${cid.toString()}`);
		}
		return readFile(join(this.dir, filename));
	}

	async *entries(): AsyncGenerator<{ cid: CID; bytes: Uint8Array }> {
		for (const [cidStr, filename] of this.index.entries()) {
			const bytes = await readFile(join(this.dir, filename));
			yield { cid: CID.parse(cidStr), bytes };
		}
	}

	async has(cid: CID): Promise<boolean> {
		return this.index.has(cid.toString());
	}

	async cleanup(): Promise<void> {
		try {
			await rm(this.dir, { recursive: true, force: true });
		} catch {
			// Directory may already be cleaned up
		}
	}
}

/**
 * In-memory blockstore for small files where disk overhead isn't needed.
 */
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

/**
 * Convert a ReadableStream into an AsyncIterable of chunks for the importer.
 */
async function* streamToFileContent(
	stream: ReadableStream<Uint8Array>,
	filename: string,
): AsyncGenerator<{ path: string; content: AsyncIterable<Uint8Array> }> {
	yield {
		path: filename,
		content: streamToAsyncIterable(stream),
	};
}

async function* streamToAsyncIterable(
	stream: ReadableStream<Uint8Array>,
): AsyncIterable<Uint8Array> {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

type Blockstore = MemoryBlockstore | DiskBlockstore;

async function writeCarToFile(
	blockstore: Blockstore,
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

// Threshold: files above this size use disk blockstore (64 MB)
const DISK_BLOCKSTORE_THRESHOLD = 64 * 1024 * 1024;

/**
 * Build a CAR file from a ReadableStream. Uses disk-backed blockstore for large files
 * to avoid buffering the entire file in memory.
 *
 * @param stream - ReadableStream of file bytes from IPFS gateway
 * @param filename - Name of the file (used in the UnixFS metadata)
 * @param sizeBytes - Expected size (used to choose memory vs disk blockstore)
 * @returns Root CID, temp file path, CAR size, and original file size
 */
export async function buildCarFromStream(
	stream: ReadableStream<Uint8Array>,
	filename: string = "file",
	sizeBytes: number = 0,
): Promise<CarFileResult> {
	const useDisk = sizeBytes > DISK_BLOCKSTORE_THRESHOLD || sizeBytes === 0;
	const blockstore = useDisk ? await DiskBlockstore.create() : new MemoryBlockstore();

	let rootCid: CID | null = null;
	let totalSize = 0;

	// Track total bytes as they flow through
	const countingStream = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			totalSize += chunk.byteLength;
			controller.enqueue(chunk);
		},
	});

	const countedStream = stream.pipeThrough(countingStream);

	for await (const entry of importer(
		streamToFileContent(countedStream, filename),
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
		if (blockstore instanceof DiskBlockstore) await blockstore.cleanup();
		throw new Error("Failed to determine CAR root CID");
	}

	const carFilePath = join(tmpdir(), `car-${crypto.randomUUID()}.car`);

	try {
		const carSize = await writeCarToFile(blockstore, rootCid, carFilePath);

		return {
			rootCid: rootCid.toString(),
			carFilePath,
			carSize,
			totalSize: totalSize || sizeBytes,
		};
	} finally {
		// Clean up blockstore (disk blocks no longer needed after CAR is written)
		if (blockstore instanceof DiskBlockstore) {
			await blockstore.cleanup();
		} else {
			blockstore.clear();
		}
	}
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
