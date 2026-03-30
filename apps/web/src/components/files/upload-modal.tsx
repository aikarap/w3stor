"use client";

import { Check, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useUploadFile } from "@/hooks/use-files";
import { useX402 } from "@/hooks/use-x402";
import { UploadZone } from "./upload-zone";

export function UploadModal() {
	const { isConnected, address } = useAccount();
	const { x402Fetch, isReady } = useX402();
	const uploadMutation = useUploadFile();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [tags, setTags] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState("");
	const [status, setStatus] = useState<"idle" | "paying" | "pinning" | "done">("idle");

	function reset() {
		setFile(null);
		setTags("");
		setDescription("");
		setError("");
		setStatus("idle");
	}

	async function handleUpload() {
		if (!file) return;
		setError("");
		setStatus("paying");

		try {
			const formData = new FormData();
			formData.append("file", file);
			if (tags) formData.append("tags", tags);
			if (description) formData.append("description", description);

			setStatus("pinning");

			if (isReady) {
				const res = await x402Fetch("/upload", { method: "POST", body: formData });
				if (!res.ok) {
					const err = await res.json().catch(() => ({ error: "Upload failed" }));
					throw new Error(err.error ?? "Upload failed");
				}
				await res.json();
			} else {
				await uploadMutation.mutateAsync({ formData });
			}

			// Invalidate file list so new file appears immediately
			if (address) {
				queryClient.invalidateQueries({ queryKey: queryKeys.files.all(address) });
			}

			setStatus("done");
			setTimeout(() => {
				setOpen(false);
				reset();
			}, 1000);
		} catch (e: any) {
			setError(e.message);
			setStatus("idle");
		}
	}

	return (
		<>
			<Button disabled={!isConnected} onClick={() => setOpen(true)}>
				<Upload className="mr-2 h-4 w-4" />
				Upload to Filecoin
			</Button>
			<Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Upload to Filecoin</DialogTitle>
				</DialogHeader>

				{status === "done" ? (
					<div className="flex flex-col items-center gap-3 py-8">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
							<Check className="h-6 w-6 text-green-400" />
						</div>
						<p className="font-medium">File pinned to IPFS</p>
						<p className="text-sm text-muted-foreground">Replication to Filecoin SPs starting...</p>
					</div>
				) : (
					<div className="space-y-4">
						<UploadZone onFileSelect={setFile} selectedFile={file} onClear={() => setFile(null)} />
						<div>
							<label className="mb-1 block text-sm text-muted-foreground">Tags (comma-separated)</label>
							<Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="dataset, research" />
						</div>
						<div>
							<label className="mb-1 block text-sm text-muted-foreground">Description</label>
							<Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this file?" rows={2} />
						</div>
						{error && (
							<div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
								{error}
							</div>
						)}
						<Button
							onClick={handleUpload}
							disabled={!file || !isReady || status !== "idle"}
							className="w-full"
						>
							{status === "pinning" ? (
								<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Pinning to IPFS...</>
							) : status === "paying" ? (
								<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirming payment...</>
							) : (
								"Upload & Pay with x402"
							)}
						</Button>
					</div>
				)}
			</DialogContent>
			</Dialog>
		</>
	);
}
