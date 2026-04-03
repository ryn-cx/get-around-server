interface RequestBody {
	url: string;
	method: string;
	headers?: Record<string, string>;
	data?: unknown;
	form?: Record<string, unknown>;
	params?: Record<string, unknown>;
	cookies?: Record<string, unknown>;
	content?: unknown;
	auth?: string | [string, string];
	timeout?: number;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
	return Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());
}

function withParams(url: string, params?: Record<string, unknown>): string {
	if (!params) {
		return url;
	}

	const u = new URL(url);
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				u.searchParams.append(key, String(item));
			}
			continue;
		}

		u.searchParams.append(key, String(value));
	}

	return u.toString();
}

function cookieHeader(cookies?: Record<string, unknown>): string | undefined {
	if (!cookies) {
		return undefined;
	}

	const entries = Object.entries(cookies)
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([key, value]) => `${key}=${String(value)}`);

	return entries.length > 0 ? entries.join("; ") : undefined;
}

function authHeader(auth?: RequestBody["auth"]): string | undefined {
	if (!auth) {
		return undefined;
	}

	if (typeof auth === "string") {
		return auth;
	}

	if (Array.isArray(auth) && auth.length >= 2) {
		const user = String(auth[0]);
		const pass = String(auth[1]);
		return `Basic ${btoa(`${user}:${pass}`)}`;
	}

	return undefined;
}

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("POST required", { status: 405 });
		}

		const token = request.headers.get("Authorization")?.replace("Bearer ", "");
		if (token !== env.AUTH_TOKEN) {
			return new Response("Unauthorized", { status: 401 });
		}

		const body = (await request.json()) as RequestBody;
		const {
			url,
			method,
			headers: incomingHeaders = {},
			data,
			form,
			params,
			cookies,
			content,
			auth,
			timeout = 30,
		} = body;

		const headers: Record<string, string> = { ...incomingHeaders };
		const cookie = cookieHeader(cookies);
		if (cookie && !hasHeader(headers, "cookie")) {
			headers.Cookie = cookie;
		}

		const authorization = authHeader(auth);
		if (authorization && !hasHeader(headers, "authorization")) {
			headers.Authorization = authorization;
		}

		const targetUrl = withParams(url, params);

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout * 1000);

		try {
			const opts: RequestInit & { headers: Record<string, string> } = {
				method,
				headers,
				signal: controller.signal,
			};

			if (form !== undefined) {
				const formParams = new URLSearchParams();
				for (const [key, value] of Object.entries(form)) {
					if (value !== undefined && value !== null) {
						formParams.append(key, String(value));
					}
				}
				opts.body = formParams.toString();
				if (!hasHeader(opts.headers, "content-type")) {
					opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
				}
			} else {
				const payload = content ?? data;
				if (payload !== undefined) {
					if (typeof payload === "object" && payload !== null) {
						opts.body = JSON.stringify(payload);
						if (!hasHeader(opts.headers, "content-type")) {
							opts.headers["Content-Type"] = "application/json";
						}
					} else {
						opts.body = String(payload);
					}
				}
			}

			const response = await fetch(targetUrl, opts);
			const responseBody = await response.text();
			const responseHeaders = Object.fromEntries(response.headers.entries());

			return new Response(
				JSON.stringify({
					statusCode: response.status,
					headers: responseHeaders,
					body: responseBody,
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
