"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "./use-api";

// --- Types ---

export interface WorkflowNode {
	id: string;
	type: string;
	data: Record<string, unknown>;
	position: { x: number; y: number };
}

export interface WorkflowEdge {
	id: string;
	source: string;
	target: string;
	[key: string]: unknown;
}

export interface Workflow {
	id: string;
	wallet_address: string;
	name: string;
	description?: string;
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	config: Record<string, unknown>;
	visibility: "private" | "public";
	created_at: string;
	updated_at: string;
}

export interface WorkflowExecution {
	id: string;
	workflow_id: string;
	wallet_address: string;
	status: "pending" | "running" | "success" | "error" | "cancelled";
	estimated_cost_usdfc?: string;
	actual_cost_usdfc?: string;
	input: Record<string, unknown>;
	output: Record<string, unknown>;
	error?: string;
	started_at: string;
	completed_at?: string;
	duration_ms?: number;
}

export interface WorkflowFile {
	id: string;
	execution_id: string;
	workflow_id: string;
	cid: string;
	node_id?: string;
	node_name?: string;
	filename?: string;
	metadata: Record<string, unknown>;
	created_at: string;
}

interface WorkflowsResponse {
	workflows: Workflow[];
	total: number;
	page: number;
	limit: number;
}

interface WorkflowExecutionsResponse {
	executions: WorkflowExecution[];
	total: number;
	page: number;
	limit: number;
}

interface WorkflowFilesResponse {
	files: WorkflowFile[];
}

// --- Hooks ---

export function useWorkflows(page = 1, limit = 20) {
	const { address } = useAccount();

	return useQuery({
		queryKey: queryKeys.workflows.list(address ?? ""),
		queryFn: () =>
			apiFetch<WorkflowsResponse>("/workflows", {
				query: { wallet: address!, page: String(page), limit: String(limit) },
			}),
		enabled: !!address,
		staleTime: 15_000,
	});
}

export function useCreateWorkflow() {
	const queryClient = useQueryClient();
	const { address } = useAccount();

	return useMutation({
		mutationFn: async (data: {
			name: string;
			description?: string;
			nodes?: WorkflowNode[];
			edges?: WorkflowEdge[];
			config?: Record<string, unknown>;
		}) =>
			apiFetch<Workflow>("/workflows", {
				method: "POST",
				body: JSON.stringify({ wallet: address, ...data }),
			}),
		onSuccess: () => {
			if (address) {
				queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list(address) });
			}
		},
		onError: (error) => {
			console.error("Failed to create workflow:", error.message);
		},
	});
}

export function useUpdateWorkflow() {
	const queryClient = useQueryClient();
	const { address } = useAccount();

	return useMutation({
		mutationFn: async ({
			id,
			...data
		}: {
			id: string;
			name?: string;
			description?: string;
			nodes?: WorkflowNode[];
			edges?: WorkflowEdge[];
			config?: Record<string, unknown>;
			visibility?: "private" | "public";
		}) =>
			apiFetch<Workflow>(`/workflows/${id}`, {
				method: "PUT",
				body: JSON.stringify({ wallet: address, ...data }),
			}),
		onSuccess: (_data, variables) => {
			if (address) {
				queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list(address) });
				queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(variables.id) });
			}
		},
		onError: (error) => {
			console.error("Failed to update workflow:", error.message);
		},
	});
}

export function useDeleteWorkflow() {
	const queryClient = useQueryClient();
	const { address } = useAccount();

	return useMutation({
		mutationFn: async (id: string) =>
			apiFetch<void>(`/workflows/${id}?wallet=${address}`, {
				method: "DELETE",
			}),
		onSuccess: () => {
			if (address) {
				queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list(address) });
			}
		},
		onError: (error) => {
			console.error("Failed to delete workflow:", error.message);
		},
	});
}

export function useExecuteWorkflow() {
	const queryClient = useQueryClient();
	const { address } = useAccount();

	return useMutation({
		mutationFn: async ({
			workflowId,
			input,
			estimatedCost,
		}: {
			workflowId: string;
			input?: Record<string, unknown>;
			estimatedCost?: number;
		}) =>
			apiFetch<WorkflowExecution>(`/workflows/${workflowId}/execute`, {
				method: "POST",
				body: JSON.stringify({ wallet: address, input, estimatedCost }),
			}),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.workflows.executions(variables.workflowId),
			});
		},
		onError: (error) => {
			console.error("Failed to execute workflow:", error.message);
		},
	});
}

export function useWorkflowExecutions(workflowId: string | null, page = 1, limit = 20) {
	const { address } = useAccount();

	return useQuery({
		queryKey: queryKeys.workflows.executions(workflowId ?? ""),
		queryFn: () =>
			apiFetch<WorkflowExecutionsResponse>(`/workflows/${workflowId}/executions`, {
				query: { wallet: address!, page: String(page), limit: String(limit) },
			}),
		enabled: !!address && !!workflowId,
		staleTime: 10_000,
	});
}

export function useWorkflowExecutionFiles(executionId: string | null) {
	const { address } = useAccount();

	return useQuery({
		queryKey: queryKeys.workflows.executionFiles(executionId ?? ""),
		queryFn: () =>
			apiFetch<WorkflowFilesResponse>(`/workflows/executions/${executionId}/files`, {
				query: { wallet: address! },
			}),
		enabled: !!address && !!executionId,
		staleTime: 30_000,
	});
}
