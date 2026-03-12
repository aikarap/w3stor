"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAccount } from "wagmi";
import { WS_URL } from "@/lib/constants";

const sockets: Record<string, Socket> = {};

export function useSocket(namespace: string) {
	const { address } = useAccount();
	const socketRef = useRef<Socket | null>(null);

	useEffect(() => {
		const key = `${namespace}:${address ?? "anon"}`;

		if (!sockets[key]) {
			sockets[key] = io(`${WS_URL}${namespace}`, {
				auth: { wallet: address },
				transports: ["websocket"],
			});
		}

		socketRef.current = sockets[key];

		return () => {
			// Singletons persist across mounts
		};
	}, [namespace, address]);

	return socketRef;
}
