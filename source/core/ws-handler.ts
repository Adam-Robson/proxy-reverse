import type { IncomingMessage } from "node:http";
import net from "node:net";
import type { Duplex } from "node:stream";
import { buildRequestHeaders } from "./headers.js";
import { matchRoute } from "./router.js";
import type { ProxyConfig, Route, Upstream } from "./types.js";

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

  const upstreams = route.upstream ?? [];

  if (upstreams.length === 0) {
    clientSocket.write("HTTP/1.1 502 No Upstream Configured\r\n\r\n");
    clientSocket.destroy();
    return;
  }

  // Choose upstream according to per-route or global balancer strategy
  const upstream = selectUpstream(route, config, upstreams);

  if (!upstream) {
    clientSocket.write("HTTP/1.1 502 No Available Upstream\r\n\r\n");
    clientSocket.destroy();
    return;
  }

  const upgradeHeaders = buildRequestHeaders(
    req,
    config.headers,
    route.headers,
    {
      host: upstream.host,
      port: upstream.port,
    },
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
    { host: upstream?.host ?? undefined, port: upstream?.port ?? undefined },
    () => {
      upstreamSocket.write(requestLine + headerBlock);
      if (head.length > 0) upstreamSocket.write(head);

      // Bidirectional pipe
      clientSocket.pipe(upstreamSocket);
      upstreamSocket.pipe(clientSocket);
    },
  );

  // Socket timeouts
  const timeoutMs = config.timeout ?? 30_000;
  if (typeof (
    clientSocket as net.Socket
  ).setTimeout === "function") (
    clientSocket as net.Socket
  ).setTimeout(timeoutMs);

  upstreamSocket.setTimeout(timeoutMs);

  upstreamSocket.once("connect", () => {
    // write already done in connect callback above
  });

  upstreamSocket.once("error", (err) => {
    console.error(`[ws] upstream error: ${err.message}`);
    safeDestroy(clientSocket);
    safeDestroy(upstreamSocket);
  });

  clientSocket.once("error", (err) => {
    console.error(`[ws] client socket error: ${err?.message ?? err}`);
    safeDestroy(upstreamSocket);
    safeDestroy(clientSocket);
  });

  upstreamSocket.once("timeout", () => {
    console.error("[ws] upstream socket timeout");
    safeDestroy(clientSocket);
    safeDestroy(upstreamSocket);
  });

  if (typeof (clientSocket as net.Socket).on === "function") {
    (clientSocket as net.Socket).once("timeout", () => {
      console.error("[ws] client socket timeout");
      safeDestroy(clientSocket);
      safeDestroy(upstreamSocket);
    });
  }

  upstreamSocket.once("close", () => safeDestroy(clientSocket));
  clientSocket.once("close", () => safeDestroy(upstreamSocket));
}

// --- helpers ---

const rrCounters = new WeakMap<Route, number>();

function selectUpstream(route: Route, config: ProxyConfig, upstreams: Upstream[]): Upstream | null {
  const strategy = route.balancer ?? config.balancer ?? "round-robin";

  if (strategy === "random") {
    return upstreams[Math.floor(Math.random() * upstreams.length)];
  }

  // default: round-robin
  const idx = rrCounters.get(route) ?? 0;
  const upstream = upstreams[idx % upstreams.length];
  rrCounters.set(route, (idx + 1) % upstreams.length);
  return upstream ?? null;
}

function safeDestroy(sock: Duplex | net.Socket | null | undefined) {
  if (!sock) return;
  try {
    if (typeof (sock as net.Socket).destroy === "function") (sock as net.Socket).destroy();
  } catch (e) {
    if (e instanceof Error) {
      console.error(`[ws] error destroying socket: ${e.message}`);
    }
  }
}
