# nrp — Node Reverse Proxy

A composable, **zero-dependency** reverse proxy for Node.js.
Works as a **standalone CLI** (`nrp`) or as a **programmatic library**.

## Features

- Route matching — prefix strings or custom predicate functions
- Path rewriting — strip prefix, add prefix, or full path replacement
- Header manipulation — set/remove headers globally or per-route
- WebSocket proxying — transparent TCP tunnel for upgrade requests (HTTP and HTTPS upstreams)
- Load balancing — round-robin, random, or weighted strategies with automatic upstream failover
- Upstream health checks — periodic TCP probes with automatic exclusion of unhealthy upstreams
- Request size limiting — per-route or global `maxBodySize` with `413` enforcement
- Per-route timeouts — override the global upstream timeout on individual routes
- Lifecycle hooks — intercept and control requests/responses
- HTTP keep-alive connection pooling — persistent connections to upstreams
- Graceful shutdown — drains in-flight requests before closing
- Structured JSON logging with configurable log levels

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [CLI](#cli)
- [Programmatic API](#programmatic-api)
- [Config reference](#config-reference)
- [Routing](#routing)
- [Path rewriting](#path-rewriting)
- [Header management](#header-management)
- [Load balancing](#load-balancing)
- [Health checks](#health-checks)
- [Request size limits](#request-size-limits)
- [WebSocket proxying](#websocket-proxying)
- [Logging](#logging)
- [Building and publishing](#building-and-publishing)

## Install

```bash
npm install @responsedotok/nrp
```

Or install globally to use the CLI anywhere:

```bash
npm install -g @responsedotok/nrp
```

## Quick start

**Via CLI:**

```bash
nrp --config ./proxy.config.json
```

**Via code:**

```ts
import { createProxy } from "@responsedotok/nrp";

const proxy = await createProxy({
  port: 8080,
  routes: [
    {
      match: "/api",
      rewrite: { stripPrefix: "/api" },
      upstreams: [{ host: "localhost", port: 3001 }],
    },
    {
      match: "/",
      upstreams: [{ host: "localhost", port: 3000 }],
    },
  ],
});

process.on("SIGTERM", () => proxy.close());
```

## CLI

```text
nrp [options]
```

| Flag | Short | Default | Description |
| --- | --- | --- | --- |
| `--config <path>` | `-c` | `./proxy.config.json` | Path to config file |
| `--log-level <level>` | `-l` | `info` | One of: `debug`, `info`, `warn`, `error`, `silent` |
| `--help` | `-h` | — | Print help and exit |

```bash
nrp --config ./config/production.json --log-level debug
nrp -c ./config/staging.json -l warn
```

### Config file formats

| Extension | Format |
| --- | --- |
| `.json` | Plain JSON object |
| `.js` / `.mjs` | ES module with `export default { ... }` |
| `.ts` | TypeScript file with `export default { ... }` |

**JSON example (`proxy.config.json`):**

```json
{
  "port": 8080,
  "host": "0.0.0.0",
  "balancer": "round-robin",
  "timeout": 30000,
  "maxBodySize": 10485760,
  "forwardIp": true,
  "healthCheck": { "interval": 30000, "timeout": 5000 },
  "headers": {
    "response": { "X-Powered-By": "nrp" },
    "removeResponse": ["server"]
  },
  "routes": [
    {
      "match": "/api",
      "rewrite": { "stripPrefix": "/api" },
      "timeout": 10000,
      "maxBodySize": 1048576,
      "upstreams": [
        { "host": "localhost", "port": 3001, "weight": 2 },
        { "host": "localhost", "port": 3002, "weight": 1 }
      ],
      "balancer": "weighted",
      "headers": {
        "request": { "X-Internal": "true" }
      }
    },
    {
      "match": "/ws",
      "upstreams": [{ "host": "localhost", "port": 4000 }]
    },
    {
      "match": "/",
      "upstreams": [{ "host": "localhost", "port": 3000 }]
    }
  ]
}
```

**TypeScript/JS example (`proxy.config.ts`):**

```ts
import type { ConfigType } from "@responsedotok/nrp";

export default {
  port: 8080,
  routes: [
    {
      match: (pathname) => pathname.startsWith("/api/v2"),
      upstreams: [{ host: "localhost", port: 3001 }],
    },
    {
      match: "/",
      upstreams: [{ host: "localhost", port: 3000 }],
    },
  ],
} satisfies ConfigType;
```

## Programmatic API

### createProxy

Convenience factory that creates a `ProxyServer`, calls `listen()`, and returns it.

```ts
import { createProxy } from "@responsedotok/nrp";
import type { ConfigType, Hooks } from "@responsedotok/nrp";

const hooks: Hooks = {
  onRequest(ctx) {
    console.log(`→ ${ctx.req.method} ${ctx.req.url}`);
    return true; // return false to send a 403 and abort
  },
  onResponse(ctx, statusCode) {
    console.log(`← ${statusCode}`);
  },
  onError(err, ctx) {
    console.error(err.message, ctx.req?.url);
  },
};

const proxy = await createProxy({ port: 8080, routes: [...] }, hooks);
process.on("SIGTERM", () => proxy.close());
```

### ProxyServer class

Use `ProxyServer` directly for more control over the server lifecycle.

```ts
import { ProxyServer } from "@responsedotok/nrp";

const server = new ProxyServer(config, hooks);
await server.listen();

const httpServer = server.httpServer; // attach Socket.IO, etc.

await server.close();       // drain in-flight requests (10 s default)
await server.close(5_000);  // custom drain timeout in ms
```

| Member | Type | Description |
| --- | --- | --- |
| `constructor(config, hooks?)` | — | Create a proxy server |
| `listen()` | `Promise<void>` | Start listening and begin upstream health checks |
| `close(drainTimeoutMs?)` | `Promise<void>` | Drain active requests then close. Defaults to 10 000 ms before force-close |
| `httpServer` | `http.Server` | The underlying `node:http` server instance |

### Hooks

All hooks are optional.

```ts
interface Hooks {
  onRequest?: (ctx: RequestContext) => boolean | Promise<boolean>;
  onResponse?: (ctx: Context, statusCode: number) => void | Promise<void>;
  onError?: (err: Error, ctx: Partial<Context>) => void;
}
```

**`onRequest`** — called before forwarding. Return `false` to abort with `403`. If the hook throws, the proxy sends `502` and calls `onError`.

| Field | Type | Description |
| --- | --- | --- |
| `req` | `http.IncomingMessage` | Incoming client request |
| `route` | `Route` | The matched route |
| `upstream` | `Upstream` | The selected upstream |
| `targetPath` | `string` | The rewritten path sent upstream |

**`onResponse`** — called after the upstream responds, before streaming to the client.

**`onError`** — called on any proxying error, including WebSocket upstream errors. Context may be partial if the error occurred before route matching.

## Config reference

### ConfigType

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `port` | `number` | — | **Required.** Port to listen on (1–65535) |
| `host` | `string` | `"0.0.0.0"` | Address to bind |
| `routes` | `Route[]` | — | **Required.** Ordered route list — first match wins |
| `headers` | `HeaderRules` | — | Global header rules applied to all routes |
| `balancer` | `LoadBalancerStrategy` | `"round-robin"` | Default load-balancing strategy |
| `timeout` | `number` | `30000` | Global upstream request timeout in ms |
| `forwardIp` | `boolean` | `true` | Append `X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto` |
| `maxBodySize` | `number` | — | Max request body in bytes; exceeding it returns `413` |
| `healthCheck` | `{ interval?: number; timeout?: number }` | — | TCP health check settings (`interval` default 30 000 ms, `timeout` default 5 000 ms) |

### Route

| Field | Type | Description |
| --- | --- | --- |
| `match` | `string` or `(pathname: string) => boolean` | Prefix string or custom predicate |
| `upstreams` | `Upstream[]` | **Required.** One or more target servers |
| `rewrite` | `RouteRewrite` | Path rewrite rules |
| `headers` | `HeaderRules` | Per-route header rules (merged with global) |
| `balancer` | `LoadBalancerStrategy` | Override the global balancer for this route |
| `timeout` | `number` | Per-route upstream timeout in ms |
| `maxBodySize` | `number` | Per-route body size limit in bytes |

### Upstream

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `host` | `string` | — | **Required.** Hostname or IP |
| `port` | `number` | — | **Required.** Port (1–65535) |
| `protocol` | `"http"` or `"https"` | `"http"` | Use `"https"` for TLS upstreams and WSS WebSocket servers |
| `weight` | `number` | `1` | Weight for the `"weighted"` balancer. Must be > 0 |

### RouteRewrite

| Field | Type | Description |
| --- | --- | --- |
| `stripPrefix` | `string` | Remove this prefix from the incoming path |
| `addPrefix` | `string` | Prepend this to the (possibly stripped) path |
| `replacePath` | `string` | Replace the entire path — overrides `stripPrefix` and `addPrefix` |

Application order: `stripPrefix` → `addPrefix`. `replacePath` skips both.

### HeaderRules

| Field | Type | Description |
| --- | --- | --- |
| `request` | `Record<string, string>` | Set/override headers on the forwarded request |
| `response` | `Record<string, string>` | Set/override headers on the response to the client |
| `removeRequest` | `string[]` | Strip these headers from the forwarded request |
| `removeResponse` | `string[]` | Strip these headers from the response to the client |

### LoadBalancerStrategy

`"round-robin"` | `"random"` | `"weighted"`

## Routing

Routes are evaluated in order — **first match wins**. Place more specific routes before less specific ones.

### String prefix matching

| `match` value | Matches |
| --- | --- |
| `"/"` | Everything (catch-all) |
| `"/api"` | `/api`, `/api/`, `/api/users`, `/api?q=1` |
| `"/api/v2"` | `/api/v2`, `/api/v2/users` — but **not** `/api/v1` |

### Custom predicate matching

Pass a function for full control — receives the raw pathname (no query string).

```ts
{
  match: (pathname) => /^\/api\/v[0-9]+/.test(pathname),
  upstreams: [{ host: "localhost", port: 3001 }],
}
```

> **Note:** Function-based matches cannot be expressed in JSON config files. Use a `.js`, `.mjs`, or `.ts` config for this feature.

## Path rewriting

```text
Incoming:  /api/users/42
stripPrefix: "/api"   ->  /users/42
addPrefix:   "/v1"    ->  /v1/users/42  (sent to upstream)
```

```json
{
  "match": "/api",
  "rewrite": { "stripPrefix": "/api", "addPrefix": "/v1" },
  "upstreams": [{ "host": "localhost", "port": 3001 }]
}
```

Use `replacePath` to always send the same path regardless of the incoming URL:

```json
{
  "match": "/health",
  "rewrite": { "replacePath": "/healthz" },
  "upstreams": [{ "host": "localhost", "port": 3001 }]
}
```

## Header management

The following happen automatically on every request:

- **Hop-by-hop header stripping** — `connection`, `keep-alive`, `transfer-encoding`, `upgrade`, and related headers are removed from both directions.
- **Host rewrite** — the `host` header is set to `upstream.host:upstream.port`.
- **X-Forwarded headers** (when `forwardIp: true`): `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto`.

Header rules at the top-level `headers` field apply to every route. Per-route rules are applied in addition to global rules (global first, then route-level).

```json
{
  "headers": {
    "response": { "X-Powered-By": "nrp" },
    "removeResponse": ["server"]
  },
  "routes": [
    {
      "match": "/api",
      "headers": { "request": { "X-Internal": "true" }, "removeRequest": ["cookie"] },
      "upstreams": [{ "host": "localhost", "port": 3001 }]
    }
  ]
}
```

## Load balancing

Set `balancer` at the top level (global default) or per-route to override it.

- **`"round-robin"`** (default) — distributes requests in a repeating cycle.
- **`"random"`** — selects an upstream at random per request.
- **`"weighted"`** — selects upstreams probabilistically by `weight` (default `1`). All weights must be > 0.

```json
{
  "match": "/api",
  "balancer": "weighted",
  "upstreams": [
    { "host": "localhost", "port": 3001, "weight": 3 },
    { "host": "localhost", "port": 3002, "weight": 1 }
  ]
}
```

### Upstream failover

When a route has multiple upstreams and a connection error occurs before any response has started, nrp automatically retries with the next untried upstream. Once all upstreams have been attempted, a `502 Bad Gateway` is returned.

## Health checks

nrp periodically probes each upstream via TCP and excludes unhealthy upstreams from load balancing. All upstreams start as healthy. If **all** upstreams for a route are unhealthy, the full list is used as a fallback to prevent a complete outage.

```json
{
  "healthCheck": { "interval": 30000, "timeout": 5000 }
}
```

| Field | Default | Description |
| --- | --- | --- |
| `interval` | `30000` | How often to probe each upstream, in ms |
| `timeout` | `5000` | How long to wait for a TCP connection before marking unhealthy |

## Request size limits

Reject oversized bodies with `413 Payload Too Large` before any upstream connection is made. A per-route value takes precedence over the global one.

```json
{
  "maxBodySize": 10485760,
  "routes": [
    {
      "match": "/upload",
      "maxBodySize": 104857600,
      "upstreams": [{ "host": "localhost", "port": 3001 }]
    }
  ]
}
```

Requests with a `content-length` exceeding the limit are rejected immediately. Chunked requests are checked as the body streams in.

## WebSocket proxying

WebSocket upgrade requests are tunneled via raw TCP. Any route whose `match` covers the upgrade path handles it automatically — no extra configuration needed.

For TLS upstreams (WSS), set `protocol: "https"` on the upstream:

```json
{
  "match": "/ws",
  "upstreams": [{ "host": "example.com", "port": 443, "protocol": "https" }]
}
```

Path rewrites, load balancing, and health checks all apply to WebSocket connections. Upstream errors are routed through the `onError` hook.

## Logging

The CLI emits structured **newline-delimited JSON** on stdout (debug/info) and stderr (warn/error).

```bash
nrp --config ./proxy.config.json --log-level debug | npx pino-pretty
```

| Level | Output |
| --- | --- |
| `debug` | stdout |
| `info` | stdout |
| `warn` | stderr |
| `error` | stderr |
| `silent` | (none) |

## Building and publishing

```bash
npm install          # install dependencies
npx tsc --noEmit     # type-check
npm test -- --run    # run tests
npm run build        # outputs to dist/
npm publish --access public  # runs build + tests via prepublishOnly
```

The build produces both **ESM** (`dist/*.mjs`) and **CommonJS** (`dist/cjs/*.js`) output, plus TypeScript declaration files.

## License

MIT
