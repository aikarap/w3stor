import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "W3Stor — Decentralized Storage for AI Agents",
		short_name: "W3Stor",
		description: "Permanent, verifiable, decentralized storage powered by Filecoin with x402 micropayments.",
		start_url: "/",
		display: "standalone",
		background_color: "#000000",
		theme_color: "#0066ff",
		icons: [
			{ src: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
		],
	};
}
