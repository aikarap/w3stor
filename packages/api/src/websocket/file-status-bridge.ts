import { getRedisConnection } from "@w3stor/modules/queue";
import { logger } from "@w3stor/shared";
import type { Server as SocketServer } from "socket.io";

export function setupFileStatusBridge(io: SocketServer): void {
	try {
		const subscriber = getRedisConnection().duplicate();

		subscriber.psubscribe("file:*:status", (err) => {
			if (err) {
				logger.error("Failed to subscribe to file status channel", { error: err.message });
				return;
			}
			logger.info("File status bridge: subscribed to file:*:status");
		});

		subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
			try {
				const cid = channel.split(":")[1];
				if (!cid) return;

				const data = JSON.parse(message);

				// Emit to /files namespace room
				io.of("/files")
					.to(`file:${cid}`)
					.emit("file:status", { cid, ...data });

				// Broadcast to /platform namespace
				io.of("/platform").emit("platform:file-status", { cid, ...data });
			} catch (error) {
				logger.error("Failed to process file status message", { channel, error });
			}
		});
	} catch (error) {
		logger.error("Failed to setup file status bridge", { error });
	}
}
