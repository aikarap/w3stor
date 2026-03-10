declare module "@x402/evm" {
	export function toClientEvmSigner(account: any, publicClient: any): any;
}

declare module "@x402/evm/exact/client" {
	export class ExactEvmScheme {
		constructor(signer: any);
	}
}

declare module "@x402/fetch" {
	export class x402Client {
		register(scheme: string, handler: any): void;
	}
	export function wrapFetchWithPayment(
		fetchFn: typeof fetch,
		client: x402Client,
	): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}
