"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocket } from "./use-socket";

interface ChatMessage {
	role: "user" | "agent";
	content: string;
	timestamp: string;
	cid?: string;
}

export function useChat(contextId: string | null) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [progressMessage, setProgressMessage] = useState("");
	const socketRef = useSocket("/chat");

	useEffect(() => {
		const socket = socketRef.current;
		if (!socket || !contextId) return;

		socket.emit("chat:join", { contextId });

		const onHistory = (history: any[]) => {
			setMessages(
				history.map((m) => ({
					role: m.role,
					content: m.content ?? m.text ?? m.message ?? "",
					timestamp: m.timestamp ?? m.created_at ?? new Date().toISOString(),
					cid: m.cid,
				})),
			);
		};

		const onResponse = (msg: any) => {
			setIsLoading(false);
			setProgressMessage("");
			setMessages((prev) => [
				...prev,
				{
					role: "agent",
					content: msg.content ?? msg.text ?? msg.message ?? "",
					timestamp: msg.timestamp ?? new Date().toISOString(),
					cid: msg.cid,
				},
			]);
		};

		const onProgress = (msg: any) => {
			setProgressMessage(msg.message ?? msg.text ?? "Processing...");
		};

		const onError = (err: any) => {
			setIsLoading(false);
			setProgressMessage("");
			setMessages((prev) => [
				...prev,
				{
					role: "agent",
					content: `Error: ${err.message ?? err.error ?? "Unknown error"}`,
					timestamp: new Date().toISOString(),
				},
			]);
		};

		socket.on("chat:history", onHistory);
		socket.on("chat:response", onResponse);
		socket.on("chat:progress", onProgress);
		socket.on("chat:error", onError);

		return () => {
			socket.off("chat:history", onHistory);
			socket.off("chat:response", onResponse);
			socket.off("chat:progress", onProgress);
			socket.off("chat:error", onError);
			socket.emit("chat:leave", { contextId });
		};
	}, [contextId, socketRef]);

	const sendMessage = useCallback(
		(text: string, cid?: string) => {
			const socket = socketRef.current;
			if (!socket || !contextId) return;

			setIsLoading(true);
			setMessages((prev) => [
				...prev,
				{ role: "user", content: text, timestamp: new Date().toISOString(), cid },
			]);
			socket.emit("chat:message", { contextId, text, cid });
		},
		[contextId, socketRef],
	);

	return { messages, isLoading, progressMessage, sendMessage };
}
