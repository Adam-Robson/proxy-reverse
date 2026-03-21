import type { IncomingMessage } from "node:http";
import net from "node:net";
import type { Duplex } from "node:stream";
import { buildRequestHeaders } from "./headers.js";
import { matchRoute } from "./router.js";
import type { ProxyConfig } from "./types.js";

/**
 * Handles WebSocket upgrade requests by tunneling raw TCP between the
 * client and the upstream server.
 *
 * Called from the "upgrade" event on the HTTP server.
 */
export function handleWebSocketUpgrade(
  req: IncomingMessage,
  clientSocket: Duplex,
  head: Buffer,
  config: ProxyConfig,
): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = matchRoute(config.routes, url.pathname);

  if (!route) {
    clientSocket.write("HTTP/1.1 502 No Matching Route\r\n\r\n");
    clientSocket.destroy();
    return;
  }

  // Simple round-robin pick for WebSocket (no custom per-route balancer here)
  const upstreams = route.upstream;
  const upstream = upstreams[Math.floor(Math.random() * upstreams.length)];

  const upgradeHeaders = buildRequestHeaders(
    req,
    config.headers,
    route.headers,
    upstream,
    config.forwardIp ?? true,
  );

  // Reconstruct the upgrade request to send to upstream
  const requestLine = `${req.method ?? "GET"} ${req.url ?? "/"} HTTP/1.1\r\n`;
  const headerBlock =
    `${Object.entries(upgradeHeaders)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\r\n")}\r\n\r\n`;

  const upstreamSocket = net.createConnection(
    { host: upstream.host, port: upstream.port },
    () => {
      upstreamSocket.write(requestLine + headerBlock);
      if (head.length > 0) upstreamSocket.write(head);

      // Bidirectional pipe
      clientSocket.pipe(upstreamSocket);
      upstreamSocket.pipe(clientSocket);
    },
  );

  upstreamSocket.on("error", (err) => {
    console.error(`[ws] upstream error: ${err.message}`);
    clientSocket.destroy();
  });

  clientSocket.on("error", () => {
    upstreamSocket.destroy();
  });

  clientSocket.on("close", () => upstreamSocket.destroy());
  upstreamSocket.on("close", () => clientSocket.destroy());
}
