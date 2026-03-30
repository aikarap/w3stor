import Link from "next/link";

export function SiteFooter() {
	return (
		<footer className="border-t border-border/50 bg-background/50">
			<div className="mx-auto max-w-7xl px-4 py-12">
				<div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
					{/* Column 1: Product */}
					<div>
						<h3 className="mb-3 text-sm font-semibold text-foreground">Product</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<Link href="/docs" className="hover:text-foreground transition-colors">
									Documentation
								</Link>
							</li>
							<li>
								<Link href="/dashboard" className="hover:text-foreground transition-colors">
									Dashboard
								</Link>
							</li>
							<li>
								<Link href="/agent-activity" className="hover:text-foreground transition-colors">
									Agent Activity
								</Link>
							</li>
						</ul>
					</div>

					{/* Column 2: Protocols */}
					<div>
						<h3 className="mb-3 text-sm font-semibold text-foreground">Protocols</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<Link href="/docs" className="hover:text-foreground transition-colors">
									REST API
								</Link>
							</li>
							<li>
								<Link href="/docs" className="hover:text-foreground transition-colors">
									A2A Protocol
								</Link>
							</li>
							<li>
								<Link href="/docs" className="hover:text-foreground transition-colors">
									MCP Server
								</Link>
							</li>
							<li>
								<Link href="/docs" className="hover:text-foreground transition-colors">
									AI SDK
								</Link>
							</li>
						</ul>
					</div>

					{/* Column 3: Integrations */}
					<div>
						<h3 className="mb-3 text-sm font-semibold text-foreground">Integrations</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<a
									href="https://sdk.vercel.ai"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground transition-colors"
								>
									Vercel AI SDK
								</a>
							</li>
							<li>
								<a
									href="https://mastra.ai"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground transition-colors"
								>
									Mastra
								</a>
							</li>
							<li>
								<a
									href="https://elizaos.ai"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground transition-colors"
								>
									ElizaOS
								</a>
							</li>
						</ul>
					</div>

					{/* Column 4: Community */}
					<div>
						<h3 className="mb-3 text-sm font-semibold text-foreground">Community</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<a
									href="https://github.com/aikarap/w3stor"
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-2 hover:text-foreground transition-colors"
								>
									<svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
										<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
									</svg>
									GitHub
								</a>
							</li>
						</ul>
					</div>
				</div>

				{/* Bottom bar */}
				<div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border/50 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
					<p>Built on Filecoin &amp; IPFS. Payments via x402 + USDFC.</p>
					<p>Any framework. Any protocol. Any chain.</p>
				</div>
			</div>
		</footer>
	);
}
