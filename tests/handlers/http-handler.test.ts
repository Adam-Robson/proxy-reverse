import type { ConfigType } from "@@/types/config.js";
import http from "node:http";
import net from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpHandler } from "@/lib/handlers/http-handler.js";

function startServer(
	handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ server: http.Server; port: number }> {
	return new Promise((resolve) => {
		const server = http.createServer(handler);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as { port: number };
			resolve({ server, port });
		});
	});
}

function request(
	port: number,
	path: string,
	opts: http.RequestOptions = {},
): Promise<{
	status: number;
	body: string;
	headers: http.IncomingHttpHeaders;
}> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ host: "127.0.0.1", port, path, ...opts },
			(res) => {
				let body = "";
				res.on("data", (chunk) => {
					body += chunk;
				});
				res.on("end", () =>
					resolve({ status: res.statusCode ?? 0, body, headers: res.headers }),
				);
			},
		);
		req.on("error", reject);
		req.end();
	});
}

describe("HttpHandler", () => {
	let upstream: { server: http.Server; port: number };
	let proxy: { server: http.Server; port: number };

	beforeAll(async () => {
		upstream = await startServer((req, res) => {
			res.writeHead(200, {
				"content-type": "text/plain",
				"x-upstream": "true",
			});
			res.end(`ok:${req.url}`);
		});

		const config: ConfigType = {
			port: 0,
			routes: [
				{
					match: "/api",
					upstreams: [{ host: "127.0.0.1", port: upstream.port }],
				},
			],
		};
		const handler = new HttpHandler(config);
		proxy = await startServer((req, res) => {
			handler.handle(req, res);
		});
	});

	afterAll(() => {
		proxy.server.close();
		upstream.server.close();
	});

	it("proxies a matching request to the upstream", async () => {
		const { status, body } = await request(proxy.port, "/api/users");
		expect(status).toBe(200);
		expect(body).toBe("ok:/api/users");
	});

	it("forwards upstream response headers to the client", async () => {
		const { headers } = await request(proxy.port, "/api/ping");
		expect(headers["x-upstream"]).toBe("true");
	});

	it("returns 502 for a path with no matching route", async () => {
		const { status } = await request(proxy.port, "/unknown");
		expect(status).toBe(502);
	});

	it("calls onRequest hook before forwarding", async () => {
		const onRequest = vi.fn().mockResolvedValue(true);
		const config: ConfigType = {
			port: 0,
			routes: [
				{ match: "/", upstreams: [{ host: "127.0.0.1", port: upstream.port }] },
			],
		};
		const handler = new HttpHandler(config, { onRequest });
		const srv = await startServer((req, res) => handler.handle(req, res));
		await request(srv.port, "/ping");
		expect(onRequest).toHaveBeenCalledOnce();
		srv.server.close();
	});

	it("returns 403 and does not forward to upstream when onRequest returns false", async () => {
		const upstreamCalled = vi.fn();
		const up = await startServer((_req, res) => {
			upstreamCalled();
			res.writeHead(200);
			res.end("upstream");
		});
		const config: ConfigType = {
			port: 0,
			routes: [
				{ match: "/", upstreams: [{ host: "127.0.0.1", port: up.port }] },
			],
		};
		const handler = new HttpHandler(config, { onRequest: () => false });
		const srv = await startServer((req, res) => handler.handle(req, res));

		const { status } = await request(srv.port, "/ping");

		expect(status).toBe(403);
		expect(upstreamCalled).not.toHaveBeenCalled();
		srv.server.close();
		up.server.close();
	});

	it("calls onResponse hook after forwarding", async () => {
		const onResponse = vi.fn().mockResolvedValue(undefined);
		const config: ConfigType = {
			port: 0,
			routes: [
				{ match: "/", upstreams: [{ host: "127.0.0.1", port: upstream.port }] },
			],
		};
		const handler = new HttpHandler(config, { onResponse });
		const srv = await startServer((req, res) => handler.handle(req, res));
		await request(srv.port, "/ping");
		expect(onResponse).toHaveBeenCalledOnce();
		srv.server.close();
	});

	it("returns 502 when upstream connection is refused", async () => {
		// Bind a server to get a free port then close it so the port is not listening
		const tmp = net.createServer();
		const closedPort = await new Promise<number>((resolve) => {
			tmp.listen(0, "127.0.0.1", () => {
				const { port } = tmp.address() as { port: number };
				tmp.close(() => resolve(port));
			});
		});

		const config: ConfigType = {
			port: 0,
			routes: [
				{ match: "/", upstreams: [{ host: "127.0.0.1", port: closedPort }] },
			],
		};
		const handler = new HttpHandler(config);
		const srv = await startServer((req, res) => handler.handle(req, res));
		const { status } = await request(srv.port, "/test");
		expect(status).toBe(502);
		srv.server.close();
	});

	it("returns 502 when upstream times out", async () => {
		const hanging = await new Promise<{ server: net.Server; port: number }>(
			(resolve) => {
				const server = net.createServer(() => {
					/* accept but never respond */
				});
				server.listen(0, "127.0.0.1", () => {
					const { port } = server.address() as { port: number };
					resolve({ server, port });
				});
			},
		);

		const config: ConfigType = {
			port: 0,
			routes: [
				{
					match: "/",
					upstreams: [{ host: "127.0.0.1", port: hanging.port }],
					timeout: 100,
				},
			],
		};
		const handler = new HttpHandler(config);
		const srv = await startServer((req, res) => handler.handle(req, res));
		const { status } = await request(srv.port, "/test");
		expect(status).toBe(502);
		srv.server.close();
		hanging.server.close();
	}, 3_000);

	it("returns 413 when content-length exceeds maxBodySize", async () => {
		const config: ConfigType = {
			port: 0,
			routes: [
				{ match: "/", upstreams: [{ host: "127.0.0.1", port: upstream.port }] },
			],
			maxBodySize: 100,
		};
		const handler = new HttpHandler(config);
		const srv = await startServer((req, res) => handler.handle(req, res));

		const { status } = await new Promise<{ status: number }>(
			(resolve, reject) => {
				const req = http.request(
					{
						host: "127.0.0.1",
						port: srv.port,
						path: "/",
						method: "POST",
						headers: { "content-length": "200" },
					},
					(res) => {
						res.resume();
						resolve({ status: res.statusCode ?? 0 });
					},
				);
				req.on("error", reject);
				req.write(Buffer.alloc(200));
				req.end();
			},
		);

		expect(status).toBe(413);
		srv.server.close();
	});

	it("handles concurrent requests without errors", async () => {
		const results = await Promise.all(
			Array.from({ length: 10 }, (_, i) =>
				request(proxy.port, `/api/concurrent-${i}`),
			),
		);
		expect(results.every((r) => r.status === 200)).toBe(true);
	});
});
