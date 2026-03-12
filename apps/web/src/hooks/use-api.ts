import { API_URL } from "@/lib/constants";

interface FetchOptions {
	method?: string;
	body?: FormData | string;
	headers?: Record<string, string>;
	query?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
	const { method = "GET", body, headers = {}, query } = options;
	let url = `${API_URL}${path}`;
	if (query) {
		const params = new URLSearchParams(query);
		url += `?${params.toString()}`;
	}
	const res = await fetch(url, {
		method,
		body,
		headers: {
			...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
			...headers,
		},
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: res.statusText }));
		throw new Error(err.error ?? err.message ?? "API error");
	}
	return res.json();
}
