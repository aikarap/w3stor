"use client";

import { CodeBlock, CodeBlockCopyButton, CodeBlockActions, CodeBlockHeader, CodeBlockTitle } from "@/components/ai-elements/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PackageInstallProps {
	/** Space-separated package names, e.g. "@w3stor/sdk ai zod" */
	packages: string;
	/** If true, installs globally (-g / global add) */
	global?: boolean;
}

function buildCommand(pm: string, packages: string, global?: boolean): string {
	if (global) {
		switch (pm) {
			case "npm":
				return `npm install -g ${packages}`;
			case "pnpm":
				return `pnpm add -g ${packages}`;
			case "yarn":
				return `yarn global add ${packages}`;
			case "bun":
				return `bun add -g ${packages}`;
			default:
				return "";
		}
	}
	switch (pm) {
		case "npm":
			return `npm install ${packages}`;
		case "pnpm":
			return `pnpm add ${packages}`;
		case "yarn":
			return `yarn add ${packages}`;
		case "bun":
			return `bun add ${packages}`;
		default:
			return "";
	}
}

const managers = ["npm", "pnpm", "yarn", "bun"] as const;

export function PackageInstall({ packages, global }: PackageInstallProps) {
	return (
		<Tabs defaultValue="npm" className="flex flex-col gap-3">
			<TabsList>
				{managers.map((pm) => (
					<TabsTrigger key={pm} value={pm} className="text-xs px-3">
						{pm}
					</TabsTrigger>
				))}
			</TabsList>
			{managers.map((pm) => (
				<TabsContent key={pm} value={pm}>
					<CodeBlock code={buildCommand(pm, packages, global)} language="bash">
						<CodeBlockHeader>
							<CodeBlockTitle>Terminal</CodeBlockTitle>
							<CodeBlockActions>
								<CodeBlockCopyButton />
							</CodeBlockActions>
						</CodeBlockHeader>
					</CodeBlock>
				</TabsContent>
			))}
		</Tabs>
	);
}
