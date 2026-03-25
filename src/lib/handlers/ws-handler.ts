import net from 'node:net';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { ConfigType } from '@@/types/config.js';
import { matchRoute } from '@/lib/router/match-route.js';
import { buildRequestHeaders } from '@/lib/headers/build-request-headers.js';

/**
 * Hanle WebSocket upgrade requests by tunneling raw TCP between the client and the upstream server.
 * @param req The incoming HTTP request.
 * @param socket The network socket between the client and the proxy.
 * @param head The first packet of the upgraded stream.
 * @param config The proxy server configuration.
 * @returns A promise that resolves when the WebSocket connection has been established.
 *
 */
export async function handleWebSocketUpgrade(
  req: IncomingMessage,
  clientSocket: Duplex,
  head: Buffer,
  config: ConfigType
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = matchRoute(config.routes, url.pathname);

  if (!route) {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    clientSocket.destroy();
    return;
  }

  const upstreams = route.upstreams;
  const upstream = upstreams[Math.floor(Math.random() * upstreams.length)];

  if (!upstream) {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    clientSocket.destroy();
    return;
  }

  const upgradeHeaders = buildRequestHeaders(
    req,
    config.headers ?? null,
    route.headers ?? null,
    upstream,
    config.forwardIp ?? true,
  );

  const requestLine = `${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/1.1\r\n`;
  const headerBlock = `${Object.entries(upgradeHeaders)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\r\n')}\r\n\r\n`;

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
