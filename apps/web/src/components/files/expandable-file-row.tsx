"use client";

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { TableCell, TableRow } from "@/components/ui/table";
import { useFileProviders } from "@/hooks/use-files";
import { useFileStatusEvents } from "@/hooks/use-file-events";
import { SPStatusRow } from "./sp-status-row";

interface ExpandableFileRowProps {
	cid: string;
	status: string;
	children: React.ReactNode;
}

export function ExpandableFileRow({ cid, status, children }: ExpandableFileRowProps) {
	const [expanded, setExpanded] = useState(false);
	const { address } = useAccount();
	const isTerminal = status === "fully_replicated" || status === "failed";

	// Subscribe to real-time updates for non-terminal files
	useFileStatusEvents(!isTerminal ? cid : null, address);

	// Fetch provider details when expanded
	const { data, isLoading } = useFileProviders(expanded ? cid : null);

	return (
		<>
			<TableRow
				className="cursor-pointer hover:bg-accent/50"
				onClick={() => setExpanded(!expanded)}
			>
				<TableCell className="w-8 px-2">
					{expanded ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</TableCell>
				{children}
			</TableRow>
			{expanded && (
				<TableRow>
					<TableCell colSpan={8} className="p-0">
						<div className="bg-muted/30 border-t border-border/50 py-2">
							<div className="px-4 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Storage Providers
							</div>
							{isLoading ? (
								<div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" />
									Loading providers...
								</div>
							) : data?.providers?.length ? (
								data.providers.map((sp) => (
									<SPStatusRow
										key={sp.spId}
										spId={sp.spId}
										status={sp.status}
										txHash={sp.txHash}
										pieceCid={sp.pieceCid}
										verifiedAt={sp.verifiedAt}
									/>
								))
							) : (
								<div className="px-4 py-3 text-sm text-muted-foreground">
									No providers assigned yet
								</div>
							)}
						</div>
					</TableCell>
				</TableRow>
			)}
		</>
	);
}
