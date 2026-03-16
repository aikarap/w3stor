"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface FileRow {
	cid: string;
	user_filename?: string;
	filename?: string;
	size_bytes?: number;
	size?: number;
	status: string;
	sp_count?: number;
	created_at?: string;
	createdAt?: string;
}

type SortKey = "name" | "size" | "status" | "sp_count" | "date";
type SortDir = "asc" | "desc";

function formatSize(bytes: number): string {
	if (!bytes || isNaN(bytes)) return "—";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getName(f: FileRow): string {
	return f.user_filename ?? f.filename ?? "";
}

function getSize(f: FileRow): number {
	return Number(f.size_bytes) || f.size || 0;
}

function getDate(f: FileRow): string {
	return f.created_at ?? f.createdAt ?? "";
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
	if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
	return dir === "asc" ? (
		<ArrowUp className="h-3 w-3 ml-1" />
	) : (
		<ArrowDown className="h-3 w-3 ml-1" />
	);
}

export function FileTable({ files }: { files: FileRow[] }) {
	const [sortKey, setSortKey] = useState<SortKey>("date");
	const [sortDir, setSortDir] = useState<SortDir>("desc");

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir(key === "date" ? "desc" : "asc");
		}
	}

	const sorted = useMemo(() => {
		const arr = [...files];
		const dir = sortDir === "asc" ? 1 : -1;
		arr.sort((a, b) => {
			switch (sortKey) {
				case "name":
					return dir * getName(a).localeCompare(getName(b));
				case "size":
					return dir * (getSize(a) - getSize(b));
				case "status":
					return dir * a.status.localeCompare(b.status);
				case "sp_count":
					return dir * ((a.sp_count ?? 0) - (b.sp_count ?? 0));
				case "date":
					return dir * (new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime());
				default:
					return 0;
			}
		});
		return arr;
	}, [files, sortKey, sortDir]);

	function copyCid(cid: string) {
		navigator.clipboard.writeText(cid);
	}

	return (
		<div className="rounded-xl border border-border/50">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>
							<button type="button" onClick={() => toggleSort("name")} className="flex items-center hover:text-foreground transition-colors">
								Name <SortIcon active={sortKey === "name"} dir={sortDir} />
							</button>
						</TableHead>
						<TableHead>CID</TableHead>
						<TableHead>
							<button type="button" onClick={() => toggleSort("size")} className="flex items-center hover:text-foreground transition-colors">
								Size <SortIcon active={sortKey === "size"} dir={sortDir} />
							</button>
						</TableHead>
						<TableHead>
							<button type="button" onClick={() => toggleSort("status")} className="flex items-center hover:text-foreground transition-colors">
								Status <SortIcon active={sortKey === "status"} dir={sortDir} />
							</button>
						</TableHead>
						<TableHead>
							<button type="button" onClick={() => toggleSort("sp_count")} className="flex items-center hover:text-foreground transition-colors">
								SPs <SortIcon active={sortKey === "sp_count"} dir={sortDir} />
							</button>
						</TableHead>
						<TableHead>
							<button type="button" onClick={() => toggleSort("date")} className="flex items-center hover:text-foreground transition-colors">
								Date <SortIcon active={sortKey === "date"} dir={sortDir} />
							</button>
						</TableHead>
						<TableHead />
					</TableRow>
				</TableHeader>
				<TableBody>
					{sorted.map((file) => (
						<TableRow key={file.cid}>
							<TableCell className="font-medium">{getName(file)}</TableCell>
							<TableCell>
								<button
									type="button"
									onClick={() => copyCid(file.cid)}
									className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
								>
									{file.cid.slice(0, 12)}...
									<Copy className="h-3 w-3" />
								</button>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{formatSize(getSize(file))}
							</TableCell>
							<TableCell>
								<StatusBadge status={file.status} />
							</TableCell>
							<TableCell className="text-muted-foreground">{file.sp_count ?? 0}</TableCell>
							<TableCell className="text-muted-foreground text-xs">
								{new Date(getDate(file)).toLocaleDateString()}
							</TableCell>
							<TableCell>
								<a
									href={`https://ipfs.io/ipfs/${file.cid}`}
									target="_blank"
									rel="noopener noreferrer"
								>
									<Button variant="ghost" size="sm">
										<Download className="h-4 w-4" />
									</Button>
								</a>
							</TableCell>
						</TableRow>
					))}
					{files.length === 0 && (
						<TableRow>
							<TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
								No files uploaded yet
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
