// These tests are AI generated and are not really used.
import {
	createExecutionContext,
	waitOnExecutionContext,
	fetchMock,
} from "cloudflare:test";
import { beforeAll, afterEach, describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const UPSTREAM = "https://upstream.example";

// The worker proxies whatever target URL is passed in the query string. The
// target is expected to be double-URI-encoded (the worker decodes it twice).
function proxyUrl(target: string): string {
	return `https://relay.example/?${encodeURIComponent(encodeURIComponent(target))}`;
}

async function callWorker(
	target: string | null,
	init: RequestInit = {}
): Promise<Response> {
	const url = target === null ? "https://relay.example/" : proxyUrl(target);
	const request = new IncomingRequest(url, init);
	const ctx = createExecutionContext();
	const response = await worker.fetch!(request);
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

describe("routing", () => {
	it("returns 400 with an explanation when no target URL is supplied", async () => {
		const response = await callWorker(null);
		expect(response.status).toBe(400);
		expect(await response.text()).toContain("No target URL provided");
	});
});

describe("relaying", () => {
	it("returns the upstream status, headers, and raw body untouched", async () => {
		fetchMock
			.get(UPSTREAM)
			.intercept({ path: "/data", method: "GET" })
			.reply(200, "hello world", {
				headers: { "content-type": "text/plain", "x-up": "1" },
			});

		const response = await callWorker(`${UPSTREAM}/data`);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello world");
		expect(response.headers.get("x-up")).toBe("1");
	});

	it("strips origin/referer/cf-/x-forwarded request headers and keeps the rest", async () => {
		let captured: Record<string, string> = {};
		fetchMock
			.get(UPSTREAM)
			.intercept({
				path: "/echo",
				method: "GET",
				headers(received: Record<string, string>) {
					captured = received;
					return true;
				},
			})
			.reply(200, "ok");

		await callWorker(`${UPSTREAM}/echo`, {
			headers: {
				"x-forwarded-for": "1.2.3.4",
				referer: "https://ref.example",
				"x-keep": "keep",
			},
		});

		expect(captured["x-keep"]).toBe("keep");
		expect(captured["x-forwarded-for"]).toBeUndefined();
		expect(captured["referer"]).toBeUndefined();
	});
});
