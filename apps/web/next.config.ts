import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		formats: ["image/avif", "image/webp"],
	},
	turbopack: {},
	webpack: (config) => {
		config.externals.push("pino-pretty", "lokijs", "encoding");
		return config;
	},
	experimental: {
		optimizePackageImports: [
			"lucide-react",
			"recharts",
			"@rainbow-me/rainbowkit",
			"motion/react",
		],
	},
	async rewrites() {
		const apiUrl = process.env.API_URL ?? "http://localhost:4000";
		return [
			{ source: "/api/a2a/:path*", destination: `${apiUrl}/a2a/:path*` },
		];
	},
};

export default nextConfig;
