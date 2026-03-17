"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { UploadZone } from "@/components/files/upload-zone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUploadFile } from "@/hooks/use-files";
import { useX402 } from "@/hooks/use-x402";

export default function UploadPage() {
	const { isConnected } = useAccount();
	const { x402Fetch, isReady } = useX402();
	const uploadMutation = useUploadFile();
	const [file, setFile] = useState<File | null>(null);
	const [tags, setTags] = useState("");
	const [description, setDescription] = useState("");
	const [result, setResult] = useState<any>(null);
	const [error, setError] = useState("");

	async function handleUpload() {
		if (!file) return;
		setError("");

		try {
			const formData = new FormData();
			formData.append("file", file);
			if (tags) formData.append("tags", tags);
			if (description) formData.append("description", description);

			if (isReady) {
				// Use x402 payment flow
				const res = await x402Fetch("/upload", { method: "POST", body: formData });
				if (!res.ok) {
					const err = await res.json().catch(() => ({ error: "Upload failed" }));
					throw new Error(err.error ?? "Upload failed");
				}
				setResult(await res.json());
			} else {
				// Direct upload attempt (will fail with 402 if payment required)
				const data = await uploadMutation.mutateAsync({ formData });
				setResult(data);
			}
		} catch (e: any) {
			setError(e.message);
		}
	}

	if (result) {
		return (
			<div className="mx-auto max-w-lg space-y-6">
				<Card>
					<CardContent className="flex flex-col items-center gap-4 p-8">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
							<Check className="h-6 w-6 text-green-400" />
						</div>
						<h2 className="text-xl font-bold">Upload Successful</h2>
						<div className="w-full space-y-3 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">CID</span>
								<code className="font-mono text-xs">{result.cid?.slice(0, 20)}...</code>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Status</span>
								<StatusBadge status={result.status} />
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Size</span>
								<span>{(result.size / 1024).toFixed(1)} KB</span>
							</div>
						</div>
						<Button
							variant="outline"
							className="mt-4"
							onClick={() => {
								setResult(null);
								setFile(null);
								setTags("");
								setDescription("");
							}}
						>
							Upload Another
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-lg space-y-6">
			<h1 className="text-2xl font-bold">Upload File</h1>
			<UploadZone onFileSelect={setFile} selectedFile={file} onClear={() => setFile(null)} />
			<div className="space-y-4">
				<div>
					<label className="mb-1 block text-sm text-muted-foreground">Tags (comma-separated)</label>
					<Input
						value={tags}
						onChange={(e) => setTags(e.target.value)}
						placeholder="dataset, research, embeddings"
					/>
				</div>
				<div>
					<label className="mb-1 block text-sm text-muted-foreground">Description</label>
					<Textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="What is this file?"
						rows={3}
					/>
				</div>
			</div>
			{error && (
				<div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
					{error}
				</div>
			)}
			{!isConnected && (
				<div className="flex flex-col items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
					<p className="text-sm text-yellow-400">
						Connect your wallet to upload files with x402 payment.
					</p>
					<ConnectButton />
				</div>
			)}
			<Button
				onClick={handleUpload}
				disabled={!file || !isReady || uploadMutation.isPending}
				className="w-full"
			>
				{uploadMutation.isPending ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Uploading...
					</>
				) : (
					"Upload & Pay with x402"
				)}
			</Button>
		</div>
	);
}
