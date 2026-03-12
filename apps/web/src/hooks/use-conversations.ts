"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "./use-api";

interface Conversation {
	context_id: string;
	wallet_address: string;
	created_at: string;
	intent?: string;
}

interface ConversationsResponse {
	conversations: Conversation[];
}

export function useConversations() {
	const { address } = useAccount();

	return useQuery({
		queryKey: queryKeys.conversations.all(address ?? ""),
		queryFn: () =>
			apiFetch<ConversationsResponse>("/conversations", {
				query: { wallet: address! },
			}),
		enabled: !!address,
	});
}

export function useCreateConversation() {
	const queryClient = useQueryClient();
	const { address } = useAccount();

	return useMutation({
		mutationFn: async () => {
			return apiFetch<Conversation>("/conversations", {
				method: "POST",
				body: JSON.stringify({ wallet: address }),
			});
		},
		onSuccess: () => {
			if (address) {
				queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all(address) });
			}
		},
		onError: (error) => {
			console.error("Failed to create conversation:", error.message);
		},
	});
}
