"use client";

import { ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";

interface SPStatusRowProps {
	spId: string;
	status: string;
	txHash: string | null;
	pieceCid: string | null;
	verifiedAt: string | null;
}

function getFilecoinTxUrl(txHash: string): string {
	return `https://filecoin-testnet.blockscout.com/tx/${txHash}`;
}

function getPdpUrl(pieceCid: string): string {
	return `https://pdp.vxb.ai/calibration/piece/${pieceCid}`;
}

export function SPStatusRow({ spId, status, txHash, pieceCid, verifiedAt }: SPStatusRowProps) {
	return (
		<div className="grid grid-cols-[minmax(120px,1fr)_auto_1fr_auto] items-center gap-3 py-2 px-4 text-sm border-b border-border/30 last:border-0">
			<span className="text-xs text-muted-foreground truncate" title={spId}>
				{spId}
			</span>

			<StatusBadge status={status} />

			<div className="min-w-0">
				{txHash ? (
					<a
						href={getFilecoinTxUrl(txHash)}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-400 hover:text-blue-300 truncate"
					>
						{txHash.slice(0, 8)}...{txHash.slice(-4)}
						<ExternalLink className="h-3 w-3 shrink-0" />
					</a>
				) : (
					<span className="text-[11px] text-muted-foreground/50">waiting...</span>
				)}
			</div>

			<div className="flex items-center gap-2 shrink-0">
				{pieceCid && (
					<a
						href={getPdpUrl(pieceCid)}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
					>
						PDP <ExternalLink className="h-3 w-3" />
					</a>
				)}
				{verifiedAt && (
					<span className="text-[11px] text-muted-foreground">
						{new Date(verifiedAt).toLocaleTimeString()}
					</span>
				)}
			</div>
		</div>
	);
}
