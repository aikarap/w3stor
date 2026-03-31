"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "./use-api";

export function usePlatformStats() {
	return useQuery({
		queryKey: queryKeys.platform.stats(),
		queryFn: () => apiFetch<any>("/platform/stats"),
		staleTime: 30_000,
	});
}

export function usePlatformActivity(page = 1, limit = 50) {
	return useQuery({
		queryKey: [...queryKeys.platform.activity(), page, limit],
		queryFn: () => apiFetch<any>("/platform/activity", {
			query: { page: String(page), limit: String(limit) },
		}),
		staleTime: 15_000,
	});
}

export function usePlatformMetrics() {
	return useQuery({
		queryKey: queryKeys.platform.metrics(),
		queryFn: () => apiFetch<any>("/platform/metrics"),
		staleTime: 30_000,
	});
}
