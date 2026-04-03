import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "node:http";
import type { HeaderRules } from "../types/header-rules.js";

/**
 * Apply header rules to the given headers.
 * @param headers The headers to apply the rules to.
 * @param rules The header rules to apply.
 * @param direction The direction of the headers ("request" or "response").
 * @returns void
 */
export function applyHeaderRules(
	headers: IncomingHttpHeaders | OutgoingHttpHeaders,
	rules: HeaderRules | null,
	direction: "request" | "response",
): void {
	if (!rules) return;

	if (direction === "request") {
		for (const k of rules.removeRequest ?? []) {
			delete headers[k.toLowerCase()];
		}
		for (const [k, v] of Object.entries(rules.request ?? {})) {
			headers[k.toLowerCase()] = v;
		}
	} else if (direction === "response") {
		for (const k of rules.removeResponse ?? []) {
			delete headers[k.toLowerCase()];
		}
		for (const [k, v] of Object.entries(rules.response ?? {})) {
			headers[k.toLowerCase()] = v;
		}
	}
}
