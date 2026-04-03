import http from "node:http";
import type { Duplex } from "node:stream";
import { HttpHandler } from "../handlers/http-handler.js";
import { handleWebSocketUpgrade } from "../handlers/ws-handler.js";
import type { ConfigType } from "../types/config.js";
import type { Hooks } from "../types/hooks.js";

export class ProxyServer {
	private readonly server: http.Server;
	private readonly handler: HttpHandler;

	constructor(config: ConfigType, hooks: Hooks = {}) {
		this.handler = new HttpHandler(config, hooks);

		this.server = http.createServer((req, res) => {
			this.handler.handle(req, res).catch((err: unknown) => {
				hooks.onError?.(err instanceof Error ? err : new Error(String(err)), {
					req,
					res,
				});
				if (!res.headersSent) {
					res.writeHead(500).end("Internal Server Error");
				}
			});
		});

		this.server.on("upgrade", (req, socket: Duplex, head) => {
			handleWebSocketUpgrade(req, socket, head, this.handler);
		});
	}

	listen(): Promise<void> {
		const { port, host = "0.0.0.0" } = this.handler.config;
		return new Promise((resolve) => {
			this.handler.start();
			this.server.listen(port, host, () => {
				resolve();
			});
		});
	}

	close(drainTimeoutMs = 10_000): Promise<void> {
		return new Promise((resolve, reject) => {
			this.handler.stop();
			this.server.closeIdleConnections();
			const timer = setTimeout(() => {
				this.server.closeAllConnections();
			}, drainTimeoutMs);
			timer.unref();
			this.server.close((err) => {
				clearTimeout(timer);
				err ? reject(err) : resolve();
			});
		});
	}

	/** Expose underlying http.Server for advanced use (e.g. attach socket.io) */
	get httpServer(): http.Server {
		return this.server;
	}
}

/**
 * Convenience factory — create and immediately start listening.
 *
 * @example
 * const proxy = await createProxy({ port: 8080, routes: [...] });
 */
export async function createProxy(
	config: ConfigType,
	hooks?: Hooks,
): Promise<ProxyServer> {
	const server = new ProxyServer(config, hooks);
	await server.listen();
	return server;
}
