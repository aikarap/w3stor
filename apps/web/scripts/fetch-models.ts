import fs from "node:fs";
import { gateway } from "@ai-sdk/gateway";

// Known image-only models
const IMAGE_ONLY_MODELS = new Set([
	"bfl/flux-2-flex",
	"bfl/flux-2-pro",
	"bfl/flux-kontext-max",
	"bfl/flux-kontext-pro",
	"bfl/flux-pro-1.1-ultra",
	"bfl/flux-pro-1.1",
	"bfl/flux-pro-1.0-fill",
	"google/imagen-4.0-generate",
	"google/imagen-4.0-fast-generate",
	"google/imagen-4.0-ultra-generate",
]);

// Known multimodal models (can generate text AND images)
const MULTIMODAL_MODELS = new Set([
	"google/gemini-3-pro-image",
	"google/gemini-2.5-flash-image",
	"google/gemini-3.1-flash-image-preview",
	"openai/gpt-5.1",
	"openai/gpt-5.1-thinking",
]);

// Video generation model patterns
const VIDEO_PATTERNS = [
	"t2v",
	"i2v",
	"r2v",
	"text-to-video",
	"image-to-video",
	"reference-to-video",
	"motion-control",
];
const VIDEO_PREFIXES = ["alibaba/wan", "bytedance/seedance", "google/veo", "klingai/kling"];

function isVideoModel(id: string): boolean {
	const lower = id.toLowerCase();
	if (VIDEO_PREFIXES.some((p) => lower.startsWith(p))) return true;
	if (VIDEO_PATTERNS.some((p) => lower.includes(p))) return true;
	return false;
}

function getCategory(
	id: string,
	modelType: string,
): "image-only" | "multimodal" | "video" | "text" {
	if (isVideoModel(id)) return "video";
	if (IMAGE_ONLY_MODELS.has(id) || modelType === "image") return "image-only";
	if (MULTIMODAL_MODELS.has(id)) return "multimodal";
	return "text";
}

async function main() {
	console.log("Fetching all available models...\n");

	const { models } = await gateway.getAvailableModels();

	const output = {
		timestamp: new Date().toISOString(),
		totalModels: models.length,
		models: models.map((m: any) => {
			const category = getCategory(m.id, m.modelType);
			return {
				modelId: m.id,
				name: m.name || m.id,
				description: m.description || null,
				category,
				modelType: m.modelType || "language",
				actionType: category === "image-only" ? "generateImage" : "generateText",
				pricing: m.pricing
					? {
							input: m.pricing.input ? parseFloat(m.pricing.input) : null,
							output: m.pricing.output ? parseFloat(m.pricing.output) : null,
							totalPrice:
								(m.pricing.input ? parseFloat(m.pricing.input) : 0) +
								(m.pricing.output ? parseFloat(m.pricing.output) : 0),
						}
					: null,
				provider: m.specification?.provider || null,
			};
		}),
		summary: {
			imageOnly: 0,
			multimodal: 0,
			video: 0,
			text: 0,
		},
	};

	for (const m of output.models) {
		if (m.category === "image-only") output.summary.imageOnly++;
		else if (m.category === "multimodal") output.summary.multimodal++;
		else if (m.category === "video") output.summary.video++;
		else output.summary.text++;
	}

	const outPath = new URL("models.json", import.meta.url).pathname;
	fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

	console.log(`Models saved to ${outPath}`);
	console.log(`Total: ${output.totalModels}`);
	console.log(`  Image-only: ${output.summary.imageOnly}`);
	console.log(`  Multimodal: ${output.summary.multimodal}`);
	console.log(`  Video: ${output.summary.video}`);
	console.log(`  Text: ${output.summary.text}`);
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
