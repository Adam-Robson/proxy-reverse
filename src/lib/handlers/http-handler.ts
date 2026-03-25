import { applyResponseHeaders } from '@/lib/headers/apply-response-headers.js';
import { buildRequestHeaders } from "@/lib/headers/build-request-headers.js";
import { createBalancer } from '@/lib/load-balancer/create-balancer.js';
import { matchRoute } from "@/lib/router/match-route.js";
import { rewritePath } from "@/lib/router/rewrite-path.js";
import type { ConfigType } from "@@/types/config.js";
import type { Context } from "@@/types/context.js";
import type { Hooks } from "@@/types/hooks.js";
import type { LoadBalancer } from '@@/types/load-balancer.js';
import type { Upstream } from "@@/types/upstream.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";
import https from "node:https";


/**
 * HTTP request handler for the reverse proxy.
 * 
 */
export class HttpHandler {
  private readonly balancers = new Map<string, LoadBalancer>();
  private readonly globalBalancer: LoadBalancer;

  constructor(
    private readonly config: ConfigType,
    private readonly hooks: Hooks = {},
  ) {
    this.globalBalancer = createBalancer(config.balancer ?? "round-robin");
  }

  /**
   * Handle an incoming HTTP request.
   * @param req The incoming HTTP request.
   * @param res The HTTP response to send back to the client.
   * @returns A promise that resolves when the request has been handled.
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    const route = matchRoute(this.config.routes, pathname);
    if (!route) {
      this.sendError(res, 502, "No matching route");
      return;
    }

    const balancer = this.getBalancer(route);
    const upstream = balancer.pick(route.upstreams);
    const targetPath = rewritePath(pathname, route.rewrite) + (url.search ?? "");
    
    const ctx: Context = { req, res, route, upstream, targetPath };

    // onRequest hook — abort if returns false
    if (this.hooks.onRequest) {
      const proceed = await this.hooks.onRequest({ req, route, upstream, targetPath });
      if (!proceed) return;
    }

    await this.forward(ctx);
  }

  /**
   * Forward the HTTP request to the upstream server.
   * @param ctx The context containing the request, response, route, and upstream information.
   * @returns A promise that resolves when the request has been forwarded and the response has been sent.
   */
  private forward(ctx: Context): Promise<void> {
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

  /**
   * Get the load balancer for the given route.
   * @param route The route for which to get the load balancer.
   * @returns The load balancer to use for the route.
   */
  private getBalancer(route: { upstreams: Upstream[]; balancer?: string }): LoadBalancer {
    if (!route.balancer) return this.globalBalancer;

    const key = route.balancer;
    if (!this.balancers.has(key)) {
      this.balancers.set(key, createBalancer(route.balancer as Parameters<typeof createBalancer>[0]));
    }
    const balancer = this.balancers.get(key);
    if (!balancer) return this.globalBalancer;
    return balancer;
  }

  /**
   * Handle an error that occurs during request processing.
   * @param err The error that occurred.
   * @param ctx The context in which the error occurred.
   * @param res The HTTP response to send back to the client.
   */
  private handleError(err: Error, ctx: Partial<Context>, res: ServerResponse): void {
    this.hooks.onError?.(err, ctx);
    if (!res.headersSent) {
      this.sendError(res, 502, "Bad Gateway");
    }
  }

  /**
   * Send an HTTP error response to the client.
   * @param res The HTTP response to send back to the client.
   * @param status The HTTP status code to send.
   * @param message The error message to send.
   */
  private sendError(res: ServerResponse, status: number, message: string): void {
    if (res.headersSent) return;
    res.writeHead(status, { "content-type": "text/plain" });
    res.end(`${status} ${message}`);
  }
}
