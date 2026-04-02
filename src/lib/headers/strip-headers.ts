import type { IncomingHttpHeaders } from "node:http2";

const HEADERS_TO_STRIP = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

export function stripHeaders(headers: IncomingHttpHeaders): void {
	const connection = headers.connection;

	if (typeof connection === "string") {
		for (const n of connection.split(",")) {
			delete headers[n.trim().toLowerCase()];
		}
	}
	for (const h of HEADERS_TO_STRIP) {
		delete headers[h.toLowerCase()];
	}
}
