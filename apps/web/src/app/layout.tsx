import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { JotaiProvider } from "@/providers/jotai-provider";
import { Web3Provider } from "@/providers/web3-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
	title: "W3S Agent — Trustless Storage for Every Agent",
	description:
		"Upload files at web2 speed. Get trustless, verifiable, permanent storage on Filecoin.",
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
