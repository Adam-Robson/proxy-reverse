import type { IncomingHttpHeaders } from "node:http";
import { describe, expect, it } from "vitest";
import { stripHeaders } from "../../src/lib/headers/strip-headers.js";

describe("stripHeaders", () => {
	it("removes all standard hop-by-hop headers", () => {
		const headers: IncomingHttpHeaders = {
			connection: "keep-alive",
			"keep-alive": "timeout=5",
			"transfer-encoding": "chunked",
			te: "trailers",
			trailer: "Expires",
			upgrade: "websocket",
			"proxy-authenticate": "Basic",
			"proxy-authorization": "Basic abc",
			"content-type": "application/json",
		};
		stripHeaders(headers);
		expect(headers.connection).toBeUndefined();
		expect(headers["keep-alive"]).toBeUndefined();
		expect(headers["transfer-encoding"]).toBeUndefined();
		expect(headers.te).toBeUndefined();
		expect(headers.trailer).toBeUndefined();
		expect(headers.upgrade).toBeUndefined();
		expect(headers["proxy-authenticate"]).toBeUndefined();
		expect(headers["proxy-authorization"]).toBeUndefined();
	});

	it("preserves non-hop-by-hop headers", () => {
		const headers: IncomingHttpHeaders = {
			"content-type": "application/json",
			"x-custom": "value",
		};
		stripHeaders(headers);
		expect(headers["content-type"]).toBe("application/json");
		expect(headers["x-custom"]).toBe("value");
	});

	it("removes headers named in the connection header value", () => {
		const headers: IncomingHttpHeaders = {
			connection: "custom-header, another-header",
			"custom-header": "value1",
			"another-header": "value2",
			"x-keep": "yes",
		};
		stripHeaders(headers);
		expect(headers["custom-header"]).toBeUndefined();
		expect(headers["another-header"]).toBeUndefined();
		expect(headers["x-keep"]).toBe("yes");
	});

	it("handles missing hop-by-hop headers gracefully", () => {
		const headers: IncomingHttpHeaders = { "content-type": "text/html" };
		expect(() => stripHeaders(headers)).not.toThrow();
		expect(headers["content-type"]).toBe("text/html");
	});

	it("handles empty headers object", () => {
		expect(() => stripHeaders({})).not.toThrow();
	});
});
