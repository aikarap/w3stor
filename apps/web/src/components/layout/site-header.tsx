"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
	{ href: "/docs", label: "Docs" },
	{ href: "/dashboard", label: "Dashboard" },
	{ href: "/agent-activity", label: "Agent Activity" },
];

export function SiteHeader() {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);
	const links = navLinks;

	return (
		<header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
				<Link href="/" className="flex items-center gap-2 font-bold text-lg">
					<span className="text-primary">w3stor</span>
					<span className="text-muted-foreground font-normal text-xs">agent</span>
				</Link>

				<nav className="hidden items-center gap-1 md:flex">
					{links.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className={cn(
								"rounded-md px-3 py-2 text-sm transition-colors",
								pathname === link.href
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{link.label}
						</Link>
					))}
				</nav>

				<div className="flex items-center gap-3">
					<a href="https://github.com/aikarap/w3stor" target="_blank" rel="noopener noreferrer">
						<Button variant="ghost" size="icon" className="h-9 w-9">
							<svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
								<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
							</svg>
						</Button>
					</a>
					<ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
					<button
						type="button"
						className="md:hidden text-muted-foreground"
						onClick={() => setMobileOpen(!mobileOpen)}
					>
						{mobileOpen ? <X size={20} /> : <Menu size={20} />}
					</button>
				</div>
			</div>

			{mobileOpen && (
				<nav className="border-t border-border/50 bg-background px-4 py-3 md:hidden">
					{links.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							onClick={() => setMobileOpen(false)}
							className={cn(
								"block rounded-md px-3 py-2 text-sm",
								pathname === link.href
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground",
							)}
						>
							{link.label}
						</Link>
					))}
				</nav>
			)}
		</header>
	);
}
