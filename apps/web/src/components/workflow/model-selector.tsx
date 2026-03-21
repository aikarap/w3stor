"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getModel, MODEL_CATEGORIES, MODELS } from "@/lib/workflow/models";
import type { ModelCategory } from "@/lib/workflow/types";

interface ModelSelectorProps {
	value: string;
	onValueChange: (modelId: string) => void;
	className?: string;
}

export function ModelSelector({ value, onValueChange, className }: ModelSelectorProps) {
	const current = getModel(value);
	const [category, setCategory] = useState<ModelCategory>(current?.category ?? "llm");

	const filteredModels = MODELS.filter((m) => m.category === category);

	return (
		<div className={cn("nopan nodrag", className)}>
			<Tabs
				value={category}
				onValueChange={(v) => {
					const newCat = v as ModelCategory;
					setCategory(newCat);
					const firstModel = MODELS.find((m) => m.category === newCat);
					if (firstModel) onValueChange(firstModel.id);
				}}
			>
				<TabsList className="h-7 w-full">
					{MODEL_CATEGORIES.map((cat) => (
						<TabsTrigger key={cat.value} value={cat.value} className="text-[10px] h-5 px-2">
							{cat.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>

			{filteredModels.length > 0 ? (
				<Select value={value} onValueChange={(v) => v && onValueChange(v)}>
					<SelectTrigger className="mt-1.5 h-8 text-xs w-full overflow-hidden">
						<SelectValue>
							{current && (
								<span className="flex items-center gap-1.5 min-w-0 overflow-hidden">
									<span className="truncate min-w-0">{current.label}</span>
									<Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">
										{current.provider}
									</Badge>
								</span>
							)}
						</SelectValue>
					</SelectTrigger>
					<SelectContent
						className="max-h-60 min-w-72 p-1"
						alignItemWithTrigger={false}
						align="start"
						sideOffset={6}
					>
						{filteredModels.map((m) => (
							<SelectItem key={m.id} value={m.id} className="text-xs">
								<span className="flex items-center gap-2 max-w-full">
									<span className="truncate min-w-0">{m.label}</span>
									<Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">
										{m.provider}
									</Badge>
									<span className="text-muted-foreground shrink-0">
										${m.costPerCall.toFixed(4)}
									</span>
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : (
				<div className="mt-1.5 h-8 flex items-center text-[10px] text-muted-foreground px-2">
					No models available
				</div>
			)}
		</div>
	);
}
