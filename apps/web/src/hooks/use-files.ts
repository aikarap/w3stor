"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "./use-api";

interface FileItem {
	cid: string;
	filename: string;
	size: number;
	status: string;
	sp_count?: number;
	piece_cid?: string;
	payment_tx_hash?: string;
	payment_network?: string;
	created_at: string;
	tags?: string;
	description?: string;
}

interface FilesResponse {
	files: FileItem[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
	replicatedCount: number;
}

export function useFiles(page = 1, limit = 20) {
	const { address } = useAccount();

	return useQuery({
		queryKey: queryKeys.files.list(address ?? "", page, limit),
		queryFn: () =>
			apiFetch<FilesResponse>("/files", {
				query: { wallet: address!, page: String(page), limit: String(limit) },
			}),
		enabled: !!address,
		staleTime: 15_000,
	});
}

export function useFileStatus(cid: string | null) {
	return useQuery({
		queryKey: queryKeys.files.status(cid ?? ""),
		queryFn: () => apiFetch<any>(`/status/${cid}`),
		enabled: !!cid,
		refetchInterval: (query) => {
			// Stop polling once fully replicated or failed
			const status = query.state.data?.status;
			if (status === "fully_replicated" || status === "failed") return false;
			return 30_000; // Fallback only — SSE handles real-time updates
		},
	});
}

export function useFileProviders(cid: string | null) {
	return useQuery({
		queryKey: queryKeys.files.detail(cid ?? ""),
		queryFn: () => apiFetch<{
			cid: string;
			pieceCid: string | null;
			status: string;
			providers: Array<{
				spId: string;
				status: string;
				url: string | null;
				txHash: string | null;
				pieceCid: string | null;
				verifiedAt: string | null;
			}>;
		}>(`/status/${cid}`),
		enabled: !!cid,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (status === "fully_replicated" || status === "failed") return false;
			return 5_000;
		},
	});
}

export function useUploadFile() {
	const queryClient = useQueryClient();
	const { address } = useAccount();

	return useMutation({
		mutationFn: async ({
			formData,
			x402Headers,
		}: {
			formData: FormData;
			x402Headers?: Record<string, string>;
		}) => {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/upload`,
				{
					method: "POST",
					body: formData,
					headers: x402Headers ?? {},
				},
			);
			if (!res.ok) {
				// Handle 402 Payment Required
				if (res.status === 402) {
					const paymentReq = await res.json();
					throw Object.assign(new Error("Payment required"), {
						status: 402,
						paymentRequirements: paymentReq,
					});
				}
				const err = await res.json().catch(() => ({ error: "Upload failed" }));
				throw new Error(err.error ?? "Upload failed");
			}
			return res.json();
		},
		onSuccess: () => {
			if (address) {
				queryClient.invalidateQueries({ queryKey: queryKeys.files.all(address) });
			}
		},
		onError: (error) => {
			// 402 errors are handled by the calling component for payment flow
			if ((error as any).status === 402) return;
			console.error("Upload failed:", error.message);
		},
	});
}
