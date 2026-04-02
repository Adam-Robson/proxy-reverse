import { applyHeaderRules } from "@@/headers/apply-header-rules.js";
import type { IncomingHttpHeaders } from "node:http";
import { describe, expect, it } from "vitest";

describe("applyHeaderRules", () => {
	it("is a no-op when rules is null", () => {
		const headers: IncomingHttpHeaders = { "x-foo": "bar" };
		applyHeaderRules(headers, null, "request");
		expect(headers["x-foo"]).toBe("bar");
	});

	it("sets request headers", () => {
		const headers: IncomingHttpHeaders = {};
		applyHeaderRules(headers, { request: { "x-custom": "value" } }, "request");
		expect(headers["x-custom"]).toBe("value");
	});

	it("removes request headers", () => {
		const headers: IncomingHttpHeaders = { "x-remove-me": "value" };
		applyHeaderRules(headers, { removeRequest: ["x-remove-me"] }, "request");
		expect(headers["x-remove-me"]).toBeUndefined();
	});

	it("sets response headers", () => {
		const headers: IncomingHttpHeaders = {};
		applyHeaderRules(
			headers,
			{ response: { "x-custom": "value" } },
			"response",
		);
		expect(headers["x-custom"]).toBe("value");
	});

	it("removes response headers", () => {
		const headers: IncomingHttpHeaders = { "x-remove-me": "value" };
		applyHeaderRules(headers, { removeResponse: ["x-remove-me"] }, "response");
		expect(headers["x-remove-me"]).toBeUndefined();
	});

	it('does not apply response rules when direction is "request"', () => {
		const headers: IncomingHttpHeaders = { "x-keep": "yes" };
		applyHeaderRules(headers, { removeResponse: ["x-keep"] }, "request");
		expect(headers["x-keep"]).toBe("yes");
	});

	it('does not apply request rules when direction is "response"', () => {
		const headers: IncomingHttpHeaders = { "x-keep": "yes" };
		applyHeaderRules(headers, { removeRequest: ["x-keep"] }, "response");
		expect(headers["x-keep"]).toBe("yes");
	});

	it("lowercases header keys when setting", () => {
		const headers: IncomingHttpHeaders = {};
		applyHeaderRules(
			headers,
			{ request: { "X-Custom-Header": "value" } },
			"request",
		);
		expect(headers["x-custom-header"]).toBe("value");
	});

	it("lowercases header keys when removing", () => {
		const headers: IncomingHttpHeaders = { "x-remove-me": "value" };
		applyHeaderRules(headers, { removeRequest: ["X-Remove-Me"] }, "request");
		expect(headers["x-remove-me"]).toBeUndefined();
	});
});
