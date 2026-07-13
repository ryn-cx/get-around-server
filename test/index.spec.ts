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

	it("forwards all request headers to the upstream unchanged", async () => {
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
		expect(captured["x-forwarded-for"]).toBe("1.2.3.4");
		expect(captured["referer"]).toBe("https://ref.example");
	});
});
