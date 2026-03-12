export const queryKeys = {
	files: {
		all: (wallet: string) => ["files", wallet] as const,
		list: (wallet: string, page: number, limit: number) =>
			["files", wallet, "list", page, limit] as const,
		detail: (cid: string) => ["files", "detail", cid] as const,
		status: (cid: string) => ["files", "status", cid] as const,
	},
	conversations: {
		all: (wallet: string) => ["conversations", wallet] as const,
		detail: (contextId: string) => ["conversations", "detail", contextId] as const,
	},
	platform: {
		stats: () => ["platform", "stats"] as const,
		activity: () => ["platform", "activity"] as const,
		metrics: () => ["platform", "metrics"] as const,
	},
	wallet: {
		balance: (address: string) => ["wallet", "balance", address] as const,
	},
	workflows: {
		all: ["workflows"] as const,
		list: (wallet: string) => [...queryKeys.workflows.all, "list", wallet] as const,
		detail: (id: string) => [...queryKeys.workflows.all, "detail", id] as const,
		executions: (id: string) => [...queryKeys.workflows.all, "executions", id] as const,
		executionFiles: (executionId: string) =>
			[...queryKeys.workflows.all, "execution-files", executionId] as const,
	},
} as const;
