# nrp — Node Reverse Proxy

A **zero-dependency** reverse proxy for Node.js. Route incoming HTTP and WebSocket traffic to one or more upstream servers with load balancing, health checks, path rewriting, and header control. Use it as a **CLI tool** or import it as a **library** in your own code.

**Requires Node.js 22+.**

## Quick start

Install:

```bash
npm install @responsedotok/nrp
```

Create a config file (`proxy.config.json`):

```json
{
  "port": 8080,
  "routes": [
    {
      "match": "/api",
      "rewrite": { "stripPrefix": "/api" },
      "upstreams": [{ "host": "localhost", "port": 3001 }]
    },
    {
      "match": "/",
      "upstreams": [{ "host": "localhost", "port": 3000 }]
    }
  ]
}
```

Run it:

```bash
npx nrp --config ./proxy.config.json
```

This listens on port 8080 and forwards `/api/*` requests to port 3001 (stripping the `/api` prefix) and everything else to port 3000.

## What it does

| Feature | Summary |
| --- | --- |
| **Routing** | Match requests by URL prefix or a custom function. First match wins. |
| **Path rewriting** | Strip a prefix, add a prefix, or replace the entire path before forwarding. |
| **Header control** | Add, override, or remove request/response headers globally or per-route. |
| **WebSocket proxying** | Transparent TCP tunnel for `Upgrade` requests. No extra config needed. |
| **Load balancing** | Round-robin, random, or weighted distribution across multiple upstreams. |
| **Health checks** | Periodic TCP probes automatically remove unhealthy upstreams from rotation. |
| **Request size limits** | Reject oversized bodies with `413` before connecting upstream. |
| **Lifecycle hooks** | Intercept requests, inspect responses, and handle errors in code. |
| **Graceful shutdown** | Drains in-flight requests before closing the server. |

---

## CLI reference

```bash
nrp [options]
```

| Flag | Short | Default | Description |
| --- | --- | --- | --- |
| `--config <path>` | `-c` | `./proxy.config.json` | Path to config file |
| `--log-level <level>` | `-l` | `info` | `debug`, `info`, `warn`, `error`, or `silent` |
| `--help` | `-h` | -- | Print help and exit |

Config files can be `.json`, `.js`/`.mjs` (ES module default export), or `.ts`.

Logs are newline-delimited JSON. Pipe to `pino-pretty` for human-readable output:

```bash
nrp -c ./proxy.config.json -l debug | npx pino-pretty
```

---

## Using nrp as a library

### createProxy (quick setup)

Creates a server, starts listening, and returns it:

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

### ProxyServer (full control)

Use `ProxyServer` directly when you need lifecycle hooks or access to the underlying HTTP server:

```ts
import { ProxyServer } from "@responsedotok/nrp";

const server = new ProxyServer(config, {
  onRequest(ctx) {
    console.log(`-> ${ctx.req.method} ${ctx.req.url}`);
    return true; // return false to abort with 403
  },
  onResponse(ctx, statusCode) {
    console.log(`<- ${statusCode}`);
  },
  onError(err, ctx) {
    console.error(err.message, ctx.req?.url);
  },
});

await server.listen();

// Access the raw http.Server (e.g. to attach Socket.IO)
const httpServer = server.httpServer;

// Graceful shutdown — drains in-flight requests (default 10s timeout)
await server.close();
```

---

## Configuration

### Top-level fields

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `port` | `number` | -- | **Required.** Port to listen on |
| `host` | `string` | `"0.0.0.0"` | Address to bind |
| `routes` | `Route[]` | -- | **Required.** Ordered list of routes (first match wins) |
| `balancer` | `string` | `"round-robin"` | Default load balancer: `"round-robin"`, `"random"`, or `"weighted"` |
| `timeout` | `number` | `30000` | Upstream request timeout in ms |
| `maxBodySize` | `number` | -- | Max request body in bytes (returns `413` if exceeded) |
| `forwardIp` | `boolean` | `true` | Add `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto` |
| `healthCheck` | `object` | -- | `{ interval?: number, timeout?: number }` for TCP health probes |
| `headers` | `HeaderRules` | -- | Global header rules (applied to all routes) |

### Route fields

| Field | Type | Description |
| --- | --- | --- |
| `match` | `string` or `function` | URL prefix (`"/api"`) or `(pathname) => boolean` |
| `upstreams` | `Upstream[]` | **Required.** Target servers |
| `rewrite` | `RouteRewrite` | Path rewrite rules |
| `headers` | `HeaderRules` | Per-route header rules (merged on top of global) |
| `balancer` | `string` | Override the global load balancer for this route |
| `timeout` | `number` | Per-route upstream timeout in ms |
| `maxBodySize` | `number` | Per-route body size limit in bytes |

### Upstream fields

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `host` | `string` | -- | **Required.** Hostname or IP |
| `port` | `number` | -- | **Required.** Port |
| `protocol` | `string` | `"http"` | `"http"` or `"https"` (use `"https"` for TLS/WSS) |
| `weight` | `number` | `1` | Weight for the `"weighted"` balancer |

### Path rewriting

Rewrites are applied in order: `stripPrefix` then `addPrefix`. Using `replacePath` skips both.

| Field | Description |
| --- | --- |
| `stripPrefix` | Remove this prefix from the incoming path |
| `addPrefix` | Prepend this to the resulting path |
| `replacePath` | Replace the entire path with this value |

Example: incoming `/api/users/42` with `stripPrefix: "/api"` and `addPrefix: "/v1"` becomes `/v1/users/42`.

### Header rules

| Field | Type | Description |
| --- | --- | --- |
| `request` | `Record<string, string>` | Headers to add/override on the upstream request |
| `response` | `Record<string, string>` | Headers to add/override on the client response |
| `removeRequest` | `string[]` | Headers to strip from the upstream request |
| `removeResponse` | `string[]` | Headers to strip from the client response |

Hop-by-hop headers (`connection`, `keep-alive`, `transfer-encoding`, etc.) are stripped automatically.

---

## Routing details

Routes are evaluated in the order they appear -- **first match wins**. Put specific routes before general ones.

| `match` value | Matches |
| --- | --- |
| `"/"` | Everything (catch-all) |
| `"/api"` | `/api`, `/api/`, `/api/users`, `/api?q=1` |
| `"/api/v2"` | `/api/v2`, `/api/v2/users` (not `/api/v1`) |

For regex or complex matching, use a function (requires a `.js`, `.mjs`, or `.ts` config file):

```ts
{
  match: (pathname) => /^\/api\/v[0-9]+/.test(pathname),
  upstreams: [{ host: "localhost", port: 3001 }],
}
```

## Load balancing

- **`"round-robin"`** (default) -- cycles through upstreams in order
- **`"random"`** -- picks one at random per request
- **`"weighted"`** -- picks based on `weight` values (higher = more traffic)

When a connection to an upstream fails before any response has started, nrp retries with the next upstream. If all upstreams fail, it returns `502 Bad Gateway`.

## Health checks

Periodic TCP probes mark unreachable upstreams as unhealthy and exclude them from load balancing. If all upstreams for a route are unhealthy, the full list is used as a fallback.

```json
{ "healthCheck": { "interval": 30000, "timeout": 5000 } }
```

## WebSocket proxying

Any route whose `match` covers the upgrade URL handles WebSocket connections automatically via raw TCP tunnel. For TLS upstreams (WSS), set `protocol: "https"`.

## Building from source

```bash
npm install
npm run build     # outputs ESM + CJS to dist/
npm test -- --run # run tests once
```

## License

MIT
