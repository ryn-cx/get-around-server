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

function proxyUrl(target: string): string {
	return `https://relay.example/?${target}`;
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

	it("relays a percent-encoded query value verbatim (leading # is not decoded)", async () => {
		let capturedPath = "";
		fetchMock
			.get(UPSTREAM)
			.intercept({
				method: "GET",
				path(received: string) {
					capturedPath = received;
					return true;
				},
			})
			.reply(200, "ok");

		const response = await callWorker(`${UPSTREAM}/search?q=%23COMPASS&n=6`);

		// %23 must survive so the upstream sees q=#COMPASS, not an empty q.
		expect(response.status).toBe(200);
		expect(capturedPath).toBe("/search?q=%23COMPASS&n=6");
	});

	async function capturedUpstreamHeaders(
		headers: Record<string, string>
	): Promise<Record<string, string>> {
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

		await callWorker(`${UPSTREAM}/echo`, { headers });
		return captured;
	}

	it("forwards ordinary request headers to the upstream unchanged", async () => {
		const captured = await capturedUpstreamHeaders({
			"x-keep": "keep",
			"if-none-match": '"abc123"',
			referer: "https://ref.example",
			origin: "https://ref.example",
		});

		expect(captured["x-keep"]).toBe("keep");
		expect(captured["if-none-match"]).toBe('"abc123"');
		expect(captured["referer"]).toBe("https://ref.example");
		expect(captured["origin"]).toBe("https://ref.example");
	});

	it("strips the headers that would expose the relay or the caller", async () => {
		const captured = await capturedUpstreamHeaders({
			"x-forwarded-for": "1.2.3.4",
			"x-forwarded-proto": "https",
			"cdn-loop": "cloudflare; loops=1",
			"cf-connecting-ip": "1.2.3.4",
			"cf-access-jwt-assertion": "token",
			"x-keep": "keep",
		});

		expect(captured["x-forwarded-for"]).toBeUndefined();
		expect(captured["x-forwarded-proto"]).toBeUndefined();
		expect(captured["cdn-loop"]).toBeUndefined();
		expect(captured["cf-connecting-ip"]).toBeUndefined();
		expect(captured["cf-access-jwt-assertion"]).toBeUndefined();
		expect(captured["x-keep"]).toBe("keep");
	});

	it("drops the Cloudflare Access cookies but keeps the caller's own", async () => {
		const captured = await capturedUpstreamHeaders({
			cookie: "CF_Authorization=jwt; session=mine; CF_AppSession=app",
		});

		expect(captured["cookie"]).toBe("session=mine");
	});

	it("drops the Cookie header entirely when only Access cookies are set", async () => {
		const captured = await capturedUpstreamHeaders({
			cookie: "CF_Authorization=jwt",
		});

		expect(captured["cookie"]).toBeUndefined();
	});
});
