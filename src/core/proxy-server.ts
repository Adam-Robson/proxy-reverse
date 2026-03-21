import http from "node:http";
import type { Duplex } from "node:stream";
import type { ProxyConfig, ProxyHooks } from "./types.js";
import { HttpProxyHandler } from "./http-handler.js";
import { handleWebSocketUpgrade } from "./ws-handler.js";

export class ProxyServer {
  private readonly server: http.Server;
  private readonly handler: HttpProxyHandler;

  constructor(
    private readonly config: ProxyConfig,
    hooks: ProxyHooks = {},
  ) {
    this.handler = new HttpProxyHandler(config, hooks);

    this.server = http.createServer((req, res) => {
      this.handler.handle(req, res).catch((err: unknown) => {
        hooks.onError?.(err instanceof Error ? err : new Error(String(err)), { req, res });
        if (!res.headersSent) {
          res.writeHead(500).end("Internal Server Error");
        }
      });
    });

    this.server.on("upgrade", (req, socket: Duplex, head) => {
      handleWebSocketUpgrade(req, socket, head, config);
    });
  }

  listen(): Promise<void> {
    const { port, host = "0.0.0.0" } = this.config;
    return new Promise((resolve) => {
      this.server.listen(port, host, () => {
        resolve();
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  /** Expose underlying http.Server */
  get httpServer(): http.Server {
    return this.server;
  }
}

/**
 * Factory function — create and immediately start listening.
 *
 * @example
 * const proxy = await createProxy({ port: 8080, routes: [...] });
 */
export async function createProxy(
  config: ProxyConfig,
  hooks?: ProxyHooks,
): Promise<ProxyServer> {
  const server = new ProxyServer(config, hooks);
  await server.listen();
  return server;
}
