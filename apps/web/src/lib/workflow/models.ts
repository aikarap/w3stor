import modelsData from "../../../scripts/models.json";
import type { ModelCategory, ModelDefinition } from "./types";

const CATEGORY_MAP: Record<string, ModelCategory> = {
	text: "llm",
	multimodal: "multimodal",
	"image-only": "image",
	video: "video",
};

export const MODELS: ModelDefinition[] = modelsData.models.map((m) => ({
	id: m.modelId,
	gatewayId: m.modelId,
	label: m.name,
	provider: m.provider,
	category: CATEGORY_MAP[m.category] ?? "llm",
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
	{ value: "video", label: "Video" },
];
