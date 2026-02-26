import { z } from "zod";

export const cidSchema = z.string().regex(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{52,})$/);
export const walletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const uploadInputSchema = z.object({
	filename: z.string().min(1),
	wallet: walletAddressSchema,
});

export const statusInputSchema = z.object({
	cid: cidSchema,
});

export const listFilesInputSchema = z.object({
	wallet: walletAddressSchema,
	page: z.number().int().positive().default(1),
	limit: z.number().int().min(1).max(100).default(20),
});

export const attestInputSchema = z.object({
	cid: cidSchema,
});
