import { applyHeaderRules } from '@/lib/headers/apply-header-rules.js';
import { stripHeaders } from '@/lib/headers/strip-headers.js';
import type { HeaderRules } from "@@/types/header-rules.js";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";

/**
 * Build the headers to send to the upstream, merging global + route rules.
 * Hop-by-hop headers are stripped automatically.
 */
export function buildRequestHeaders(
  req: IncomingMessage,
  globalRules: HeaderRules | null,
  routeRules: HeaderRules | null,
  upstream: { host: string; port: number },
  forwardIp: boolean,
): IncomingHttpHeaders {
  const headers: IncomingHttpHeaders = { ...req.headers };

  // Always strip hop-by-hop headers before forwarding
  stripHeaders(headers);

  // Rewrite Host to point at the upstream
  headers.host = `${upstream.host}:${upstream.port}`;

  if (forwardIp) {
    const existing = headers["x-forwarded-for"];
    const clientIp = req.socket.remoteAddress ?? "unknown";
    headers["x-forwarded-for"] = existing ? `${existing}, ${clientIp}` : clientIp;
    headers["x-forwarded-proto"] ??= (req.socket as { encrypted?: boolean }).encrypted ? "https" : "http";
    headers["x-forwarded-host"] ??= req.headers.host ?? "";
  }

  applyHeaderRules(headers, globalRules, "request");
  applyHeaderRules(headers, routeRules, "request");

  return headers;
}
