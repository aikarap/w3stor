export function bytesToMB(bytes: number): number {
	return bytes / (1024 * 1024);
}

export function sanitizeFilename(filename: string): string {
	return filename.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 255);
}
