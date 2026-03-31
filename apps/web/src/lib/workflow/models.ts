import type { ModelCategory, ModelDefinition } from "./types";

/** Curated set of simple, low-cost models — 2 per category. */
const ALLOWED_MODELS: Record<ModelCategory, string[]> = {
	llm: ["alibaba/qwen-3-14b", "openai/gpt-4o-mini"],
	image: ["bfl/flux-2-klein-4b", "google/imagen-4.0-fast-generate-001"],
	multimodal: ["google/gemini-2.5-flash-image", "google/gemini-3.1-flash-image-preview"],
};

const ALLOWED_IDS = new Set(Object.values(ALLOWED_MODELS).flat());

import modelsData from "../../../scripts/models.json";

const CATEGORY_MAP: Record<string, ModelCategory | "video"> = {
	text: "llm",
	multimodal: "multimodal",
	"image-only": "image",
	video: "video",
};

export const MODELS: ModelDefinition[] = modelsData.models
	.filter((m) => ALLOWED_IDS.has(m.modelId))
	.map((m) => ({
		id: m.modelId,
		gatewayId: m.modelId,
		label: m.name,
		provider: m.provider,
		category: (CATEGORY_MAP[m.category] ?? "llm") as ModelCategory,
		costPerCall: Math.max(m.pricing.totalPrice, 0.0001),
		...(m.description ? { description: m.description } : {}),
	}));

export function getModel(id: string): ModelDefinition | undefined {
	return MODELS.find((m) => m.id === id);
}

export function getModelsByCategory(category: ModelCategory): ModelDefinition[] {
	return MODELS.filter((m) => m.category === category);
}

export const MODEL_CATEGORIES: { value: ModelCategory; label: string }[] = [
	{ value: "llm", label: "Text" },
	{ value: "image", label: "Image" },
	{ value: "multimodal", label: "Multi" },
];
