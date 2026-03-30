"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { API_URL } from "@/lib/constants";

/**
 * Subscribe to SSE events for a specific file's replication status.
 * Uses a ref to keep a stable connection that survives re-renders.
 * Auto-reconnects on error (EventSource default behavior).
 * Closes only on unmount or when cid becomes null (terminal state).
 */
export function useFileStatusEvents(cid: string | null, walletAddress: string | undefined) {
	const queryClient = useQueryClient();
	const eventSourceRef = useRef<EventSource | null>(null);
	const cidRef = useRef(cid);
	const walletRef = useRef(walletAddress);
	cidRef.current = cid;
	walletRef.current = walletAddress;

	useEffect(() => {
		if (!cid) {
			// Close existing connection if cid goes null (file reached terminal state)
			eventSourceRef.current?.close();
			eventSourceRef.current = null;
			return;
		}

		// Don't create duplicate connections for the same cid
		if (eventSourceRef.current) {
			return;
		}

		const es = new EventSource(`${API_URL}/events/files/${cid}`);
		eventSourceRef.current = es;

		es.addEventListener("file-status", () => {
			const currentCid = cidRef.current;
			const wallet = walletRef.current;
			if (currentCid) {
				queryClient.invalidateQueries({ queryKey: queryKeys.files.status(currentCid) });
				queryClient.invalidateQueries({ queryKey: queryKeys.files.detail(currentCid) });
			}
			if (wallet) {
				queryClient.invalidateQueries({ queryKey: queryKeys.files.all(wallet) });
			}
		});

		es.addEventListener("done", () => {
			es.close();
			eventSourceRef.current = null;
		});

		// Let the browser auto-reconnect on transient errors instead of closing
		// EventSource reconnects automatically by default

		return () => {
			es.close();
			eventSourceRef.current = null;
		};
	}, [cid, queryClient]);
}

/**
 * Subscribe to platform-wide file events.
 * Invalidates platform queries when any file status changes.
 */
export function usePlatformEvents() {
	const queryClient = useQueryClient();
	const eventSourceRef = useRef<EventSource | null>(null);

	useEffect(() => {
		if (eventSourceRef.current) return;

		const es = new EventSource(`${API_URL}/events/platform`);
		eventSourceRef.current = es;

		es.addEventListener("file-status", () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.platform.activity() });
			queryClient.invalidateQueries({ queryKey: queryKeys.platform.stats() });
			queryClient.invalidateQueries({ queryKey: queryKeys.platform.metrics() });
		});

		return () => {
			es.close();
			eventSourceRef.current = null;
		};
	}, [queryClient]);
}
