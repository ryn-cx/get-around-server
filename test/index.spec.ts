// These tests are AI generated and are not really used.
import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	fetchMock,
} from "cloudflare:test";
import { beforeAll, afterEach, describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const testEnv = { ...env };
const UPSTREAM = "https://upstream.example";

interface Payload {
	url: string;
	method: string;
	headers?: Record<string, string>;
	body?: string;
	followRedirects?: boolean;
	timeout?: number;
}

interface RelayResult {
	statusCode: number;
	headers: Record<string, string>;
	body: string;
	encoding: string;
}

async function callWorker(
	payload: Payload,
	init: { method?: string } = {}
): Promise<Response> {
	const method = init.method ?? "POST";
	const withBody = method !== "GET" && method !== "HEAD";
	const request = new IncomingRequest("https://relay.example/", {
		method,
		body: withBody ? JSON.stringify(payload) : undefined,
	});
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, testEnv, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
});

afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
});

describe("method", () => {
	it("rejects non-POST requests", async () => {
		const response = await callWorker(
			{ url: `${UPSTREAM}/x`, method: "GET" },
			{ method: "GET" }
		);
		expect(response.status).toBe(405);
	});
});

describe("relaying", () => {
	it("returns the upstream status, headers, and base64-encoded body", async () => {
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/data", method: "GET" })
			.reply(200, "hello world", { headers: { "content-type": "text/plain", "x-up": "1" } });

		const response = await callWorker({ url: `${UPSTREAM}/data`, method: "GET" });
		expect(response.status).toBe(200);

		const result = (await response.json()) as RelayResult;
		expect(result.statusCode).toBe(200);
		expect(result.encoding).toBe("base64");
		expect(atob(result.body)).toBe("hello world");
		expect(result.headers["x-up"]).toBe("1");
	});

	it("forwards the method, headers, and decoded body upstream", async () => {
		let forwardedBody: string | undefined;
		fetchMock
			.get(UPSTREAM)
			.intercept({
				path: "/submit",
				method: "POST",
				headers: { "x-custom": "abc" },
				body(received) {
					forwardedBody = received;
					return received === "payload-bytes";
				},
			})
			.reply(201, "created");

		const response = await callWorker({
			url: `${UPSTREAM}/submit`,
			method: "POST",
			headers: { "x-custom": "abc", "content-type": "text/plain" },
			body: btoa("payload-bytes"),
		});

		const result = (await response.json()) as RelayResult;
		expect(result.statusCode).toBe(201);
		expect(forwardedBody).toBe("payload-bytes");
	});

	it("does not follow redirects by default", async () => {
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/go", method: "GET" })
			.reply(302, "", { headers: { location: `${UPSTREAM}/dest` } });

		const response = await callWorker({ url: `${UPSTREAM}/go`, method: "GET" });
		const result = (await response.json()) as RelayResult;
		expect(result.statusCode).toBe(302);
		expect(result.headers["location"]).toBe(`${UPSTREAM}/dest`);
	});

	it("returns 502 when the upstream request fails", async () => {
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/boom", method: "GET" })
			.replyWithError(new Error("connection reset"));

		const response = await callWorker({ url: `${UPSTREAM}/boom`, method: "GET" });
		expect(response.status).toBe(502);

		const result = (await response.json()) as { error: string };
		expect(result.error).toContain("connection reset");
	});
});

describe("content-encoding", () => {
	it("strips a declared encoding that the body does not match", async () => {
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/badgzip", method: "GET" })
			.reply(200, "not actually gzip", {
				headers: { "content-encoding": "gzip", "content-length": "17" },
			});

		const response = await callWorker({ url: `${UPSTREAM}/badgzip`, method: "GET" });
		const result = (await response.json()) as RelayResult;
		expect(result.headers["content-encoding"]).toBeUndefined();
		expect(result.headers["content-length"]).toBeUndefined();
		expect(atob(result.body)).toBe("not actually gzip");
	});

	it("preserves a declared encoding whose body carries the matching magic bytes", async () => {
		const gzipBytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x11, 0x22]);
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/gzip", method: "GET" })
			.reply(200, gzipBytes, { headers: { "content-encoding": "gzip" } });

		const response = await callWorker({ url: `${UPSTREAM}/gzip`, method: "GET" });
		const result = (await response.json()) as RelayResult;
		expect(result.headers["content-encoding"]).toBe("gzip");
	});
});
