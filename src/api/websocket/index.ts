import type { Server as HTTPServer } from "node:http";
import { logger } from "@w3stor/shared";
import { Server as SocketServer } from "socket.io";
import { setupChatNamespace } from "./chat-handler";
import { setupFileStatusBridge } from "./file-status-bridge";

export function setupSocketIO(httpServer: HTTPServer): SocketServer {
	const io = new SocketServer(httpServer, {
		cors: {
			origin: process.env.CORS_ORIGIN ?? "*",
			methods: ["GET", "POST"],
		},
	});

	// Wallet auth middleware
	const walletMiddleware = (socket: any, next: any) => {
		const wallet = socket.handshake.auth?.wallet;
		if (!wallet || typeof wallet !== "string") {
			return next(new Error("Wallet address required"));
		}
		socket.data.wallet = wallet.toLowerCase();
		next();
	};

	// Chat namespace
	const chatNs = io.of("/chat");
	chatNs.use(walletMiddleware);
	setupChatNamespace(chatNs);

	// Files namespace — subscribe to file status updates
	const filesNs = io.of("/files");
	filesNs.use(walletMiddleware);
	filesNs.on("connection", (socket) => {
		logger.info("Files namespace connected", { wallet: socket.data.wallet });

		socket.on("files:subscribe", ({ cid }: { cid: string }) => {
			socket.join(`file:${cid}`);
		});

		socket.on("files:unsubscribe", ({ cid }: { cid: string }) => {
			socket.leave(`file:${cid}`);
		});
	});

	// Platform namespace — public live events
	io.of("/platform");

	// File status bridge (Redis pub/sub → Socket.io)
	setupFileStatusBridge(io);

	logger.info("Socket.IO initialized with /chat, /files, /platform namespaces");

	return io;
}
