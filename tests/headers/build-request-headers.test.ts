import { buildRequestHeaders } from "@@/headers/build-request-headers.js";
import type { Upstream } from "@@/types/upstream.js";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";

function mockReq(
	headers: Record<string, string> = {},
	remoteAddress = "127.0.0.1",
): IncomingMessage {
	return {
		headers: { host: "localhost", ...headers },
		socket: { remoteAddress },
	} as unknown as IncomingMessage;
}

const upstream: Upstream = { host: "upstream.local", port: 8080 };

describe("buildRequestHeaders", () => {
	it("rewrites Host to upstream host:port", () => {
		const headers = buildRequestHeaders(mockReq(), null, null, upstream, false);
		expect(headers.host).toBe("upstream.local:8080");
	});

	it("strips hop-by-hop headers", () => {
		const req = mockReq({
			"transfer-encoding": "chunked",
			"content-type": "text/plain",
		});
		const headers = buildRequestHeaders(req, null, null, upstream, false);
		expect(headers["transfer-encoding"]).toBeUndefined();
		expect(headers["content-type"]).toBe("text/plain");
	});

	it("adds X-Forwarded-* headers when forwardIp is true", () => {
		const headers = buildRequestHeaders(mockReq(), null, null, upstream, true);
		expect(headers["x-forwarded-for"]).toBe("127.0.0.1");
		expect(headers["x-forwarded-proto"]).toBe("http");
		expect(headers["x-forwarded-host"]).toBe("localhost");
	});

	it("appends to an existing X-Forwarded-For header", () => {
		const req = mockReq({ "x-forwarded-for": "10.0.0.1" });
		const headers = buildRequestHeaders(req, null, null, upstream, true);
		expect(headers["x-forwarded-for"]).toBe("10.0.0.1, 127.0.0.1");
	});

	it("does not add X-Forwarded-* headers when forwardIp is false", () => {
		const headers = buildRequestHeaders(mockReq(), null, null, upstream, false);
		expect(headers["x-forwarded-for"]).toBeUndefined();
		expect(headers["x-forwarded-proto"]).toBeUndefined();
		expect(headers["x-forwarded-host"]).toBeUndefined();
	});

	it("applies global header rules", () => {
		const headers = buildRequestHeaders(
			mockReq(),
			{ request: { "x-global": "g" } },
			null,
			upstream,
			false,
		);
		expect(headers["x-global"]).toBe("g");
	});

	it("applies route header rules", () => {
		const headers = buildRequestHeaders(
			mockReq(),
			null,
			{ request: { "x-route": "r" } },
			upstream,
			false,
		);
		expect(headers["x-route"]).toBe("r");
	});

	it("route rules are applied after global rules", () => {
		const headers = buildRequestHeaders(
			mockReq(),
			{ request: { "x-priority": "global" } },
			{ request: { "x-priority": "route" } },
			upstream,
			false,
		);
		expect(headers["x-priority"]).toBe("route");
	});

	it("copies original request headers", () => {
		const req = mockReq({ "x-original": "preserved" });
		const headers = buildRequestHeaders(req, null, null, upstream, false);
		expect(headers["x-original"]).toBe("preserved");
	});
});
