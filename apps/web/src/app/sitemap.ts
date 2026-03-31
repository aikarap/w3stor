import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://w3stor.xyz";

	return [
		{ url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
		{ url: `${baseUrl}/docs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
		{ url: `${baseUrl}/docs/ai-sdk`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
		{ url: `${baseUrl}/docs/elizaos`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
		{ url: `${baseUrl}/docs/mastra`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
		{ url: `${baseUrl}/docs/mcp`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
		{ url: `${baseUrl}/docs/a2a`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
		{ url: `${baseUrl}/docs/cli`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
		{ url: `${baseUrl}/agent-activity`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
		{ url: `${baseUrl}/dashboard`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
	];
}
