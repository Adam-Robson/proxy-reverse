import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";
import https from "node:https";
import { createBalancer, type ILoadBalancer } from "./balancer.js";
import { applyResponseHeaders, buildRequestHeaders } from "./headers.js";
import { matchRoute, rewritePath } from "./router.js";
import type { ProxyConfig, ProxyContext, ProxyHooks, Route } from "./types.js";

export class HttpProxyHandler {
  private readonly balancers = new Map<string, ILoadBalancer>();
  private readonly globalBalancer: ILoadBalancer;

  constructor(
    private readonly config: ProxyConfig,
    private readonly hooks: ProxyHooks = {},
  ) {
    this.globalBalancer = createBalancer(config.balancer ?? "round-robin");
  }

  // ── Public entry point ──────────────────────────────────────────────────────

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    const route = matchRoute(this.config.routes, pathname);
    if (!route) {
      this.sendError(res, 502, "No matching route");
      return;
    }

    const balancer = this.getBalancer(route);
    const upstreams = route.upstream ?? (route as any).upstreams ?? [];
    if (!upstreams || upstreams.length === 0) {
      this.sendError(res, 502, "No upstreams configured for route");
      return;
    }
    const upstream = balancer.pick(upstreams);
    const targetPath = rewritePath(pathname, route.rewrite) + (url.search ?? "");

    const ctx: ProxyContext = { req, res, route, upstream, targetPath };

    // onRequest hook — abort if returns false
    if (this.hooks.onRequest) {
      const proceed = await this.hooks.onRequest({ req, route, upstream, targetPath });
      if (!proceed) return;
    }

    await this.forward(ctx);
  }

  // ── HTTP forwarding ─────────────────────────────────────────────────────────

  private forward(ctx: ProxyContext): Promise<void> {
    return new Promise((resolve) => {
      const { req, res, upstream, targetPath, route } = ctx;
      const protocol = upstream.protocol ?? "http";
      const transport = protocol === "https" ? https : http;

      const forwardHeaders = buildRequestHeaders(
        req,
        this.config.headers,
        route.headers,
        upstream,
        this.config.forwardIp ?? true,
      );

      const options: http.RequestOptions = {
        hostname: upstream.host,
        port: upstream.port,
        method: req.method,
        path: targetPath,
        headers: forwardHeaders,
        timeout: this.config.timeout ?? 30_000,
      };

      const proxyReq = transport.request(options, (proxyRes) => {
        res.statusCode = proxyRes.statusCode ?? 502;

        // Forward upstream response headers to client
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value !== undefined) res.setHeader(key, value);
        }

        applyResponseHeaders(res, this.config.headers, route.headers);

        if (this.hooks.onResponse) {
          Promise.resolve(this.hooks.onResponse(ctx, res.statusCode)).then(() => {
            proxyRes.pipe(res, { end: true });
            resolve();
          });
        } else {
          proxyRes.pipe(res, { end: true });
          proxyRes.on("end", resolve);
        }
      });

      proxyReq.on("timeout", () => {
        proxyReq.destroy();
        this.handleError(new Error(`Upstream timeout (${upstream.host}:${upstream.port})`), ctx, res);
        resolve();
      });

      proxyReq.on("error", (err) => {
        this.handleError(err, ctx, res);
        resolve();
      });

      req.pipe(proxyReq, { end: true });
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private getBalancer(route: Route): ILoadBalancer {
    if (!route.balancer) return this.globalBalancer;

    const key = route.balancer;
    const existing = this.balancers.get(key);
    if (existing) return existing;

    const bal = createBalancer(key);
    this.balancers.set(key, bal);
    return bal;
  }

  private handleError(err: Error, ctx: Partial<ProxyContext>, res: ServerResponse): void {
    this.hooks.onError?.(err, ctx);
    if (!res.headersSent) {
      this.sendError(res, 502, "Bad Gateway");
    }
  }

  private sendError(res: ServerResponse, status: number, message: string): void {
    if (res.headersSent) return;
    res.writeHead(status, { "content-type": "text/plain" });
    res.end(`${status} ${message}`);
  }
}
