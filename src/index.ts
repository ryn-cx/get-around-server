interface RequestBody {
	url: string;
	method: string;
	headers?: Record<string, string>;
	body?: string;
	followRedirects?: boolean;
	timeout?: number;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

function base64ToBytes(data: string): Uint8Array {
	const binary = atob(data);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function bodyMatchesEncoding(encoding: string, bytes: Uint8Array): boolean {
	if (encoding === "gzip") {
		return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
	}
	if (encoding === "deflate") {
		return (
			bytes.length >= 2 &&
			(bytes[0] & 0x0f) === 0x08 &&
			(((bytes[0] << 8) | bytes[1]) % 31 === 0)
		);
	}
	return true;
}

export default {
	async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("POST required", { status: 405 });
		}

		const payload = (await request.json()) as RequestBody;
		const { url, method, headers = {}, body, followRedirects = false, timeout = 30 } = payload;

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout * 1000);

		try {
			const opts: RequestInit = {
				method,
				headers,
				signal: controller.signal,
				redirect: followRedirects ? "follow" : "manual",
			};

			if (body !== undefined && method !== "GET" && method !== "HEAD") {
				const bytes = base64ToBytes(body);
				if (bytes.length > 0) {
					opts.body = bytes;
				}
			}

			const response = await fetch(url, opts);
			const responseHeaders = Object.fromEntries(response.headers.entries());
			const rawBytes = new Uint8Array(await response.arrayBuffer());

			const declaredEncoding = (responseHeaders["content-encoding"] ?? "").toLowerCase();
			if (declaredEncoding && !bodyMatchesEncoding(declaredEncoding, rawBytes)) {
				delete responseHeaders["content-encoding"];
				delete responseHeaders["content-length"];
			}

			return new Response(
				JSON.stringify({
					statusCode: response.status,
					headers: responseHeaders,
					body: bytesToBase64(rawBytes),
					encoding: "base64",
				}),
				{ headers: { "Content-Type": "application/json" } }
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return new Response(
				JSON.stringify({ error: message }),
				{ status: 502, headers: { "Content-Type": "application/json" } }
			);
		} finally {
			clearTimeout(timer);
		}
	},
} satisfies ExportedHandler<Env>;
