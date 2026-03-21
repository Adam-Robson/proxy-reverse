import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import type { HeaderRules } from "./types.js";

/**
 * Build the headers to send to the upstream, merging global + route rules.
 * Hop-by-hop headers are stripped automatically.
 */
export function buildRequestHeaders(
  req: IncomingMessage,
  globalRules: HeaderRules | undefined,
  routeRules: HeaderRules | undefined,
  upstream: { host: string; port: number },
  forwardIp: boolean,
): IncomingHttpHeaders {
  const headers: IncomingHttpHeaders = { ...req.headers };

  // Always strip hop-by-hop headers before forwarding
  stripHopByHop(headers);

  // Rewrite Host to point at the upstream
  headers["host"] = `${upstream.host}:${upstream.port}`;

  if (forwardIp) {
    const existing = headers["x-forwarded-for"];
    const clientIp = req.socket.remoteAddress ?? "unknown";
    headers["x-forwarded-for"] = existing ? `${existing}, ${clientIp}` : clientIp;
    headers["x-forwarded-proto"] ??= "http";
    headers["x-forwarded-host"] ??= req.headers["host"] ?? "";
  }

  applyHeaderRules(headers, globalRules, "request");
  applyHeaderRules(headers, routeRules, "request");

  return headers;
}

/**
 * Apply response header rules before sending back to the client.
 */
export function applyResponseHeaders(
  res: ServerResponse,
  globalRules: HeaderRules | undefined,
  routeRules: HeaderRules | undefined,
): void {
  // Remove headers listed for removal
  for (const key of [
    ...(globalRules?.removeResponse ?? []),
    ...(routeRules?.removeResponse ?? []),
  ]) {
    res.removeHeader(key);
  }

  // Set/override headers
  for (const rules of [globalRules?.response, routeRules?.response]) {
    if (!rules) continue;
    for (const [key, value] of Object.entries(rules)) {
      res.setHeader(key, value);
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function stripHopByHop(headers: IncomingHttpHeaders): void {
  // Also strip anything listed in the Connection header
  const connection = headers["connection"];
  if (typeof connection === "string") {
    for (const name of connection.split(",")) {
      delete headers[name.trim().toLowerCase()];
    }
  }
  for (const name of HOP_BY_HOP) {
    delete headers[name];
  }
}

function applyHeaderRules(
  headers: IncomingHttpHeaders,
  rules: HeaderRules | undefined,
  direction: "request",
): void {
  if (!rules) return;

  for (const key of rules.removeRequest ?? []) {
    delete headers[key.toLowerCase()];
  }

  for (const [key, value] of Object.entries(rules.request ?? {})) {
    headers[key.toLowerCase()] = value;
  }
}
