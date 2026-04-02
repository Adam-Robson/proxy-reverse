import { applyResponseHeaders } from "@@/headers/apply-response-headers.js";
import type { ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";

function mockRes(): ServerResponse {
	return {
		removeHeader: vi.fn(),
		setHeader: vi.fn(),
	} as unknown as ServerResponse;
}

describe("applyResponseHeaders", () => {
	it("removes headers listed in globalRules.removeResponse", () => {
		const res = mockRes();
		applyResponseHeaders(res, { removeResponse: ["x-powered-by"] }, undefined);
		expect(res.removeHeader).toHaveBeenCalledWith("x-powered-by");
	});

	it("removes headers listed in routeRules.removeResponse", () => {
		const res = mockRes();
		applyResponseHeaders(res, undefined, {
			removeResponse: ["x-frame-options"],
		});
		expect(res.removeHeader).toHaveBeenCalledWith("x-frame-options");
	});

	it("sets headers from globalRules.response", () => {
		const res = mockRes();
		applyResponseHeaders(
			res,
			{ response: { "x-custom": "global" } },
			undefined,
		);
		expect(res.setHeader).toHaveBeenCalledWith("x-custom", "global");
	});

	it("sets headers from routeRules.response", () => {
		const res = mockRes();
		applyResponseHeaders(res, undefined, { response: { "x-custom": "route" } });
		expect(res.setHeader).toHaveBeenCalledWith("x-custom", "route");
	});

	it("applies both global and route rules", () => {
		const res = mockRes();
		applyResponseHeaders(
			res,
			{ response: { "x-global": "g" } },
			{ response: { "x-route": "r" } },
		);
		expect(res.setHeader).toHaveBeenCalledWith("x-global", "g");
		expect(res.setHeader).toHaveBeenCalledWith("x-route", "r");
	});

	it("handles undefined rules without throwing", () => {
		const res = mockRes();
		expect(() => applyResponseHeaders(res, undefined, undefined)).not.toThrow();
		expect(res.removeHeader).not.toHaveBeenCalled();
		expect(res.setHeader).not.toHaveBeenCalled();
	});
});
