"use client";

import { FileText, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
	onFileSelect: (file: File) => void;
	selectedFile: File | null;
	onClear: () => void;
}

export function UploadZone({ onFileSelect, selectedFile, onClear }: UploadZoneProps) {
	const [isDragOver, setIsDragOver] = useState(false);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			const file = e.dataTransfer.files[0];
			if (file) onFileSelect(file);
		},
		[onFileSelect],
	);

	if (selectedFile) {
		return (
			<div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-6">
				<FileText className="h-10 w-10 text-primary" />
				<div className="flex-1 min-w-0">
					<div className="truncate font-medium">{selectedFile.name}</div>
					<div className="text-sm text-muted-foreground">
						{(selectedFile.size / 1024).toFixed(1)} KB &middot; {selectedFile.type || "unknown"}
					</div>
				</div>
				<button onClick={onClear} className="text-muted-foreground hover:text-foreground">
					<X className="h-5 w-5" />
				</button>
			</div>
		);
	}

	return (
		<label
			onDragOver={(e) => {
				e.preventDefault();
				setIsDragOver(true);
			}}
			onDragLeave={() => setIsDragOver(false)}
			onDrop={handleDrop}
			className={cn(
				"flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition-colors",
				isDragOver ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50",
			)}
		>
			<Upload className="h-10 w-10 text-muted-foreground" />
			<div>
				<div className="font-medium">Drop a file here or click to browse</div>
				<div className="text-sm text-muted-foreground">
					Any file type. Stored permanently on Filecoin.
				</div>
			</div>
			<input
				type="file"
				className="hidden"
				onChange={(e) => {
					const f = e.target.files?.[0];
					if (f) onFileSelect(f);
				}}
			/>
		</label>
	);
}
