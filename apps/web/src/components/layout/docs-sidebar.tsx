"use client";

import { Book, Bot, Cpu, Package, Sparkles, Terminal, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sections = [
	{ href: "/docs", label: "Overview", icon: Book },
	{ href: "/docs/cli", label: "w3stor CLI", icon: Terminal },
	{ href: "/docs/mcp", label: "MCP Server", icon: Wrench },
	{ href: "/docs/a2a", label: "A2A Protocol", icon: Cpu },
	{ href: "/docs/ai-sdk", label: "AI SDK", icon: Sparkles },
	{ href: "/docs/elizaos", label: "ElizaOS", icon: Bot },
	{ href: "/docs/mastra", label: "Mastra", icon: Package },
];

export function DocsSidebar() {
	const pathname = usePathname();
	return (
		<nav className="hidden w-56 shrink-0 lg:block">
			<div className="sticky top-20 space-y-1">
				{sections.map((s) => {
					const Icon = s.icon;
					return (
						<Link
							key={s.href}
							href={s.href}
							className={cn(
								"flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
								pathname === s.href
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Icon className="h-4 w-4" />
							{s.label}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
