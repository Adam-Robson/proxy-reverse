import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";
import https from "node:https";
import { applyResponseHeaders } from "../headers/apply-response-headers.js";
import { buildRequestHeaders } from "../headers/build-request-headers.js";
import { HealthMonitor } from "../health/health-monitor.js";
import { createBalancer } from "../load-balancer/create-balancer.js";
import { matchRoute } from "../router/match-route.js";
import { rewritePath } from "../router/rewrite-path.js";
import type { ConfigType } from "../types/config.js";
import type { Context } from "../types/context.js";
import type { Hooks } from "../types/hooks.js";
import type { LoadBalancer } from "../types/load-balancer.js";
import type { Upstream } from "../types/upstream.js";

export class HttpHandler {
	private readonly balancers = new Map<string, LoadBalancer>();
	private readonly globalBalancer: LoadBalancer;
	private readonly httpAgent = new http.Agent({ keepAlive: true });
	private readonly httpsAgent = new https.Agent({ keepAlive: true });
	private readonly healthMonitor: HealthMonitor;

	constructor(
		readonly config: ConfigType,
		private readonly hooks: Hooks = {},
	) {
		this.globalBalancer = createBalancer(config.balancer ?? "round-robin");

		const allUpstreams = [
			...new Map(
				config.routes
					.flatMap((r) => r.upstreams)
					.map((u) => [`${u.host}:${u.port}`, u]),
			).values(),
		];
		this.healthMonitor = new HealthMonitor(
			allUpstreams,
			config.healthCheck?.interval,
			config.healthCheck?.timeout,
		);
	}

	start(): void {
		this.healthMonitor.start();
	}

	stop(): void {
		this.healthMonitor.stop();
	}

	async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const url = new URL(req.url ?? "/", "http://localhost");
		const pathname = url.pathname;

		const route = matchRoute(this.config.routes, pathname);
		if (!route) {
			this.sendError(res, 502, "No matching route");
			return;
		}

		const maxBodySize = route.maxBodySize ?? this.config.maxBodySize;
		if (maxBodySize !== undefined) {
			const contentLength = Number(req.headers["content-length"]);
			if (!Number.isNaN(contentLength) && contentLength > maxBodySize) {
				req.resume();
				this.sendError(res, 413, "Payload Too Large");
				return;
			}
		}

		const healthy = route.upstreams.filter((u) =>
			this.healthMonitor.isHealthy(u),
		);
		const candidates = healthy.length > 0 ? healthy : route.upstreams;
		const balancer = this.getBalancer(route);
		const upstream = balancer.pick(candidates);
		const targetPath =
			rewritePath(pathname, route.rewrite) + (url.search ?? "");

		const ctx: Context = { req, res, route, upstream, targetPath };

		// onRequest hook — abort if returns false
		if (this.hooks.onRequest) {
			try {
				const proceed = await this.hooks.onRequest({
					req,
					route,
					upstream,
					targetPath,
				});
				if (!proceed) {
					this.sendError(res, 403, "Forbidden");
					return;
				}
			} catch (err) {
				this.handleError(
					err instanceof Error ? err : new Error(String(err)),
					ctx,
					res,
				);
				return;
			}
		}

		await this.forward(ctx, new Set<Upstream>([upstream]));
	}

	private forward(ctx: Context, triedUpstreams: Set<Upstream>): Promise<void> {
		return new Promise((resolve) => {
			const { req, res, upstream, targetPath, route } = ctx;
			const protocol = upstream.protocol ?? "http";
			const transport = protocol === "https" ? https : http;

			const forwardHeaders = buildRequestHeaders(
				req,
				this.config.headers ?? null,
				route.headers ?? null,
				upstream,
				this.config.forwardIp ?? true,
			);

			const options: http.RequestOptions = {
				hostname: upstream.host,
				port: upstream.port,
				method: req.method,
				path: targetPath,
				headers: forwardHeaders,
				timeout: route.timeout ?? this.config.timeout ?? 30_000,
				agent: protocol === "https" ? this.httpsAgent : this.httpAgent,
			};

			const proxyReq = transport.request(options, (proxyRes) => {
				res.statusCode = proxyRes.statusCode ?? 502;

				// Forward upstream response headers to client
				for (const [key, value] of Object.entries(proxyRes.headers)) {
					if (value !== undefined) res.setHeader(key, value);
				}

				applyResponseHeaders(res, this.config.headers, route.headers);

				proxyRes.on("error", (err) => {
					this.handleError(err, ctx, res);
					resolve();
				});

				if (this.hooks.onResponse) {
					Promise.resolve(this.hooks.onResponse(ctx, res.statusCode)).then(
						() => {
							proxyRes.pipe(res, { end: true });
							resolve();
						},
					);
				} else {
					proxyRes.pipe(res, { end: true });
					proxyRes.on("end", resolve);
				}
			});

			proxyReq.on("timeout", () => {
				proxyReq.destroy();
				this.handleError(
					new Error(`Upstream timeout (${upstream.host}:${upstream.port})`),
					ctx,
					res,
				);
				resolve();
			});

			let bodyTooLarge = false;

			proxyReq.on("error", (err) => {
				if (bodyTooLarge) {
					if (!res.headersSent) this.sendError(res, 413, "Payload Too Large");
					resolve();
					return;
				}
				if (!res.headersSent) {
					const [nextUpstream] = route.upstreams.filter(
						(u) => !triedUpstreams.has(u),
					);
					if (nextUpstream) {
						triedUpstreams.add(upstream);
						const nextCtx = { ...ctx, upstream: nextUpstream };
						this.forward(nextCtx, triedUpstreams).then(resolve);
						return;
					}
				}
				this.handleError(err, ctx, res);
				resolve();
			});

			req.on("error", (err) => {
				this.handleError(err, ctx, res);
				resolve();
			});

			const maxBodySize = route.maxBodySize ?? this.config.maxBodySize;
			if (maxBodySize !== undefined) {
				let bodyBytes = 0;
				req.on("data", (chunk: Buffer) => {
					bodyBytes += chunk.length;
					if (!bodyTooLarge && bodyBytes > maxBodySize) {
						bodyTooLarge = true;
						req.resume();
						proxyReq.destroy();
					}
				});
			}

			req.pipe(proxyReq, { end: true });
		});
	}

	getBalancer(route: {
		upstreams: Upstream[];
		balancer?: string;
	}): LoadBalancer {
		if (!route.balancer) return this.globalBalancer;

		const key = route.balancer;
		if (!this.balancers.has(key)) {
			this.balancers.set(
				key,
				createBalancer(route.balancer as Parameters<typeof createBalancer>[0]),
			);
		}
		const balancer = this.balancers.get(key);
		if (!balancer) return this.globalBalancer;
		return balancer;
	}

	/**
	 * Notify the onError hook without sending an HTTP response.
	 * Used by the WebSocket handler where there is no ServerResponse.
	 */
	notifyError(err: Error, ctx: Partial<Context> = {}): void {
		this.hooks.onError?.(err, ctx);
	}

	private handleError(
		err: Error,
		ctx: Partial<Context>,
		res: ServerResponse,
	): void {
		this.hooks.onError?.(err, ctx);
		if (!res.headersSent) {
			this.sendError(res, 502, "Bad Gateway");
		}
	}

	private sendError(
		res: ServerResponse,
		status: number,
		message: string,
	): void {
		if (res.headersSent) return;
		res.writeHead(status, { "content-type": "text/plain" });
		res.end(`${status} ${message}`);
	}
}
