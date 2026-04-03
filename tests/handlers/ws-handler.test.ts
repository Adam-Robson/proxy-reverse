import http from "node:http";
import net from "node:net";
import type { Duplex } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { HttpHandler } from "../../src/lib/handlers/http-handler.js";
import { handleWebSocketUpgrade } from "../../src/lib/handlers/ws-handler.js";
import type { ConfigType } from "../../src/lib/types/config.js";

function mockSocket() {
	return {
		write: vi.fn(),
		destroy: vi.fn(),
		pipe: vi.fn(),
		on: vi.fn(),
	} as unknown as Duplex & {
		write: ReturnType<typeof vi.fn>;
		destroy: ReturnType<typeof vi.fn>;
	};
}

function mockReq(url: string) {
	return {
		url,
		method: "GET",
		headers: { host: "localhost" },
		socket: { remoteAddress: "127.0.0.1" },
	} as never;
}

const config: ConfigType = {
	port: 8080,
	routes: [{ match: "/ws", upstreams: [{ host: "localhost", port: 9000 }] }],
};

function startTcpUpstream(
	onConnect: (socket: net.Socket) => void,
): Promise<{ server: net.Server; port: number }> {
	return new Promise((resolve) => {
		const server = net.createServer(onConnect);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as { port: number };
			resolve({ server, port });
		});
	});
}

function startHttpProxy(
	handler: HttpHandler,
): Promise<{ server: http.Server; port: number }> {
	return new Promise((resolve) => {
		const server = http.createServer();
		server.on("upgrade", (req, socket, head) => {
			handleWebSocketUpgrade(req, socket as Duplex, head, handler);
		});
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as { port: number };
			resolve({ server, port });
		});
	});
}

describe("handleWebSocketUpgrade", () => {
	it("sends 502 and destroys socket when no route matches", async () => {
		const handler = new HttpHandler(config);
		const socket = mockSocket();
		await handleWebSocketUpgrade(
			mockReq("/unknown"),
			socket,
			Buffer.alloc(0),
			handler,
		);
		expect(socket.write).toHaveBeenCalledWith(
			"HTTP/1.1 502 Bad Gateway\r\n\r\n",
		);
		expect(socket.destroy).toHaveBeenCalled();
	});

	it("sends 502 and destroys socket when route has no upstreams", async () => {
		const cfg: ConfigType = {
			port: 8080,
			routes: [{ match: "/ws", upstreams: [] }],
		};
		const handler = new HttpHandler(cfg);
		const socket = mockSocket();
		await handleWebSocketUpgrade(
			mockReq("/ws"),
			socket,
			Buffer.alloc(0),
			handler,
		);
		expect(socket.write).toHaveBeenCalledWith(
			"HTTP/1.1 502 Bad Gateway\r\n\r\n",
		);
		expect(socket.destroy).toHaveBeenCalled();
	});

	it("tunnels the upgrade request to the upstream and returns 101", async () => {
		const upstream = await startTcpUpstream((socket) => {
			socket.once("data", () => {
				socket.write(
					"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n",
				);
			});
		});

		const cfg: ConfigType = {
			port: 0,
			routes: [
				{
					match: "/ws",
					upstreams: [{ host: "127.0.0.1", port: upstream.port }],
				},
			],
		};
		const proxy = await startHttpProxy(new HttpHandler(cfg));

		const response = await new Promise<string>((resolve, reject) => {
			const client = net.createConnection(
				{ host: "127.0.0.1", port: proxy.port },
				() => {
					client.write(
						"GET /ws HTTP/1.1\r\n" +
							"Host: localhost\r\n" +
							"Upgrade: websocket\r\n" +
							"Connection: Upgrade\r\n" +
							"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
							"Sec-WebSocket-Version: 13\r\n\r\n",
					);
				},
			);
			let data = "";
			client.on("data", (chunk) => {
				data += chunk.toString();
				if (data.includes("\r\n\r\n")) {
					client.destroy();
					resolve(data);
				}
			});
			client.on("error", reject);
		});

		expect(response).toContain("101");

		proxy.server.close();
		upstream.server.close();
	});
});
