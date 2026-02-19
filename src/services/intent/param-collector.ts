import { calculateUploadCost } from "@w3stor/modules/x402";
import type { Intent, ParamStatus } from "@w3stor/shared";

interface RequiredParams {
	[key: string]: {
		check: (params: Record<string, unknown>) => boolean;
		prompt: string;
		priority: number;
	};
}

const STORE_PARAMS: RequiredParams = {
	file: {
		check: (p) => !!p.fileData || !!p.fileBytes,
		prompt: "Please attach the file you would like to store on Filecoin.",
		priority: 1,
	},
	payment: {
		check: (p) => {
			if (!p.fileData && !p.fileBytes) return true;
			return !!p.payment;
		},
		prompt: "",
		priority: 2,
	},
};

const RETRIEVE_PARAMS: RequiredParams = {
	cid: {
		check: (p) => !!p.cid,
		prompt: "Which file would you like to retrieve? Please provide the CID (Content Identifier).",
		priority: 1,
	},
};

const LIST_PARAMS: RequiredParams = {
	wallet: {
		check: (p) => !!p.walletAddress,
		prompt: "Which wallet address would you like to list files for?",
		priority: 1,
	},
};

const STATUS_PARAMS: RequiredParams = {
	identifier: {
		check: (p) => !!p.cid,
		prompt: "Which file would you like to check? Please provide the CID.",
		priority: 1,
	},
};

const ATTEST_PARAMS: RequiredParams = {
	cid: {
		check: (p) => !!p.cid,
		prompt: "Which file would you like an attestation for? Please provide the CID.",
		priority: 1,
	},
};

const PARAM_MAP: Record<Intent, RequiredParams> = {
	store: STORE_PARAMS,
	retrieve: RETRIEVE_PARAMS,
	list: LIST_PARAMS,
	status: STATUS_PARAMS,
	attest: ATTEST_PARAMS,
	conversation: {},
};

export function checkParams(intent: Intent, collectedParams: Record<string, unknown>): ParamStatus {
	const requirements = PARAM_MAP[intent] || {};
	const missing: string[] = [];

	const sorted = Object.entries(requirements).sort(([, a], [, b]) => a.priority - b.priority);

	for (const [name, req] of sorted) {
		if (!req.check(collectedParams)) {
			missing.push(name);
		}
	}

	if (missing.length === 0) {
		return {
			complete: true,
			missing: [],
			collected: collectedParams,
			nextPrompt: "",
		};
	}

	const firstMissing = missing[0];
	let nextPrompt = requirements[firstMissing]?.prompt || `Please provide: ${firstMissing}`;

	if (firstMissing === "payment") {
		const size = (collectedParams.sizeBytes as number) || 0;
		const cost = calculateUploadCost(size);
		nextPrompt = `This file is ${formatBytes(size)} and requires an x402 micropayment of $${cost.toFixed(6)}. Please provide your payment signature to proceed.`;
	}

	return {
		complete: false,
		missing,
		collected: collectedParams,
		nextPrompt,
	};
}

export function mergeParams(
	existing: Record<string, unknown>,
	extracted: Record<string, unknown>,
): Record<string, unknown> {
	return { ...existing, ...extracted };
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

