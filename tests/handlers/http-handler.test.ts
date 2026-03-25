import http from 'node:http';
import { HttpHandler } from '@@/handlers/http-handler.js';
import type { ConfigType } from '@@/types/config.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

function startServer(
	handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ server: http.Server; port: number }> {
	return new Promise((resolve) => {
		const server = http.createServer(handler);
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address() as { port: number };
			resolve({ server, port });
		});
	});
}

function request(
	port: number,
	path: string,
	opts: http.RequestOptions = {},
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
	return new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, path, ...opts }, (res) => {
			let body = '';
			res.on('data', (chunk) => {
				body += chunk;
			});
			res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
		});
		req.on('error', reject);
		req.end();
	});
}

describe('HttpHandler', () => {
	let upstream: { server: http.Server; port: number };
	let proxy: { server: http.Server; port: number };

	beforeAll(async () => {
		upstream = await startServer((req, res) => {
			res.writeHead(200, { 'content-type': 'text/plain', 'x-upstream': 'true' });
			res.end(`ok:${req.url}`);
		});

		const config: ConfigType = {
			port: 0,
			routes: [{ match: '/api', upstreams: [{ host: '127.0.0.1', port: upstream.port }] }],
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

	it('proxies a matching request to the upstream', async () => {
		const { status, body } = await request(proxy.port, '/api/users');
		expect(status).toBe(200);
		expect(body).toBe('ok:/api/users');
	});

	it('forwards upstream response headers to the client', async () => {
		const { headers } = await request(proxy.port, '/api/ping');
		expect(headers['x-upstream']).toBe('true');
	});

	it('returns 502 for a path with no matching route', async () => {
		const { status } = await request(proxy.port, '/unknown');
		expect(status).toBe(502);
	});

	it('calls onRequest hook before forwarding', async () => {
		const onRequest = vi.fn().mockResolvedValue(true);
		const config: ConfigType = {
			port: 0,
			routes: [{ match: '/', upstreams: [{ host: '127.0.0.1', port: upstream.port }] }],
		};
		const handler = new HttpHandler(config, { onRequest });
		const srv = await startServer((req, res) => handler.handle(req, res));
		await request(srv.port, '/ping');
		expect(onRequest).toHaveBeenCalledOnce();
		srv.server.close();
	});

	it('does not forward to upstream when onRequest returns false', async () => {
		const upstreamCalled = vi.fn();
		const up = await startServer((_req, res) => {
			upstreamCalled();
			res.writeHead(200);
			res.end('upstream');
		});
		const config: ConfigType = {
			port: 0,
			routes: [{ match: '/', upstreams: [{ host: '127.0.0.1', port: up.port }] }],
		};
		const handler = new HttpHandler(config, { onRequest: () => false });
		const srv = await startServer((req, res) => handler.handle(req, res));

		const req = http.request({ host: '127.0.0.1', port: srv.port, path: '/ping' });
		req.on('error', () => {}); // swallow error from forced close
		req.end();
		await new Promise((r) => setTimeout(r, 100));

		expect(upstreamCalled).not.toHaveBeenCalled();
		srv.server.closeAllConnections();
		srv.server.close();
		up.server.closeAllConnections();
		up.server.close();
	});

	it('calls onResponse hook after forwarding', async () => {
		const onResponse = vi.fn().mockResolvedValue(undefined);
		const config: ConfigType = {
			port: 0,
			routes: [{ match: '/', upstreams: [{ host: '127.0.0.1', port: upstream.port }] }],
		};
		const handler = new HttpHandler(config, { onResponse });
		const srv = await startServer((req, res) => handler.handle(req, res));
		await request(srv.port, '/ping');
		expect(onResponse).toHaveBeenCalledOnce();
		srv.server.close();
	});
});
