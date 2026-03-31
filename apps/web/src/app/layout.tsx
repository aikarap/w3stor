import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { JotaiProvider } from "@/providers/jotai-provider";
import { Web3Provider } from "@/providers/web3-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = "https://w3stor.xyz";
const SITE_NAME = "W3Stor";
const DEFAULT_DESCRIPTION =
	"Decentralized storage for AI agents. Upload files at web2 speed, get permanent verifiable storage on Filecoin with x402 micropayments.";

export const metadata: Metadata = {
	title: {
		default: "W3Stor — Decentralized Storage for AI Agents",
		template: "%s | W3Stor",
	},
	description: DEFAULT_DESCRIPTION,
	metadataBase: new URL(SITE_URL),
	keywords: [
		"decentralized storage",
		"Filecoin",
		"IPFS",
		"AI agents",
		"x402",
		"micropayments",
		"web3 storage",
		"MCP",
		"A2A protocol",
		"AI SDK",
		"ElizaOS",
		"Mastra",
		"onchain cloud",
	],
	authors: [{ name: "W3Stor", url: SITE_URL }],
	creator: "W3Stor",
	openGraph: {
		type: "website",
		locale: "en_US",
		url: SITE_URL,
		siteName: SITE_NAME,
		title: "W3Stor — Decentralized Storage for AI Agents",
		description: DEFAULT_DESCRIPTION,
		images: [
			{
				url: "/images/logo-512.png",
				width: 512,
				height: 512,
				alt: "W3Stor Logo",
			},
		],
	},
	twitter: {
		card: "summary",
		title: "W3Stor — Decentralized Storage for AI Agents",
		description: DEFAULT_DESCRIPTION,
		images: ["/images/logo-512.png"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: { index: true, follow: true },
	},
	icons: {
		icon: "/images/icon-192.png",
		apple: "/images/icon-512.png",
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased max-w-7xl mx-auto`}>
				<Web3Provider>
					<JotaiProvider>
						<TooltipProvider>{children}</TooltipProvider>
					</JotaiProvider>
				</Web3Provider>
			</body>
		</html>
	);
}
