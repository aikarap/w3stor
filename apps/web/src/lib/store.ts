import { atom } from "jotai";

// ---------------------------------------------------------------------------
// Demo state — controls the swarm visualizer and cost accrual
// ---------------------------------------------------------------------------
export type DemoPhase = "idle" | "running" | "storing" | "complete";

export const demoPhaseAtom = atom<DemoPhase>("idle");
export const demoCostAtom = atom<number>(0); // accrued cost in USDFC
export const demoArtifactCountAtom = atom<number>(0);

// ---------------------------------------------------------------------------
// Pricing calculator state
// ---------------------------------------------------------------------------
export const pricingAgentsAtom = atom<number>(3);
export const pricingRuntimeMinAtom = atom<number>(2);
export const pricingStorageMBAtom = atom<number>(10);
export const pricingMemoryOpsAtom = atom<number>(50);

// Derived: total cost
export const pricingTotalAtom = atom((get) => {
	const agents = get(pricingAgentsAtom);
	const runtime = get(pricingRuntimeMinAtom);
	const storage = get(pricingStorageMBAtom);
	const memoryOps = get(pricingMemoryOpsAtom);
	// $0.014/agent-min compute + $0.0001/MB storage + $0.00005/graph-add + $0.00002/graph-connect
	const compute = agents * runtime * 0.014;
	const storageCost = storage * 0.0001;
	// Assume ~60% adds, ~40% connects in a typical memory workload
	const memoryCost = memoryOps * (0.6 * 0.00005 + 0.4 * 0.00002);
	return compute + storageCost + memoryCost;
});

// ---------------------------------------------------------------------------
// Landing page scroll state
// ---------------------------------------------------------------------------
export const activeHeroSectionAtom = atom<string | null>(null);
