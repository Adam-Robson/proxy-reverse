# nrp — Node Reverse Proxy

A composable, **zero-dependency** reverse proxy for Node.js.
Works as a **standalone CLI** (`nrp`) or as a **programmatic library**.

## Features

- Route matching — prefix strings or custom predicate functions
- Path rewriting — strip prefix, add prefix, or full path replacement
- Header manipulation — set/remove headers globally or per-route
- WebSocket proxying — transparent TCP tunnel for upgrade requests
- Load balancing — round-robin, random, or weighted strategies
- Lifecycle hooks — intercept and control requests/responses
- Structured JSON logging with configurable log levels
- Environment variable overrides for runtime configuration

---

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [CLI](#cli)
  - [Options](#options)
  - [Config file formats](#config-file-formats)
  - [Environment variables](#environment-variables)
- [Programmatic API](#programmatic-api)
  - [createProxy](#createproxy)
  - [ProxyServer class](#proxyserver-class)
  - [Hooks](#hooks)
- [Config reference](#config-reference)
  - [ConfigType](#configtype)
  - [Route](#route)
  - [Upstream](#upstream)
  - [RouteRewrite](#routerewrite)
  - [HeaderRules](#headerrules)
  - [LoadBalancerStrategy](#loadbalancerstrategy)
- [Routing](#routing)
  - [String prefix matching](#string-prefix-matching)
  - [Custom predicate matching](#custom-predicate-matching)
  - [Match order](#match-order)
- [Path rewriting](#path-rewriting)
- [Header management](#header-management)
  - [Automatic processing](#automatic-processing)
  - [Global and per-route rules](#global-and-per-route-rules)
- [Load balancing](#load-balancing)
- [WebSocket proxying](#websocket-proxying)
- [Logging](#logging)
- [Building and publishing](#building-and-publishing)

---

## Install

```bash
npm install @responsedotok/nrp
```

Or install globally to use the CLI anywhere:

```bash
npm install -g nrp
```

---

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

---

## CLI

```text
nrp [options]
```

### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--config <path>` | `-c` | `./proxy.config.json` | Path to config file |
| `--log-level <level>` | `-l` | `info` | One of: `debug`, `info`, `warn`, `error`, `silent` |
| `--help` | `-h` | — | Print help and exit |

```bash
# Use a specific config file at debug verbosity
nrp --config ./config/production.json --log-level debug

# Short flags
nrp -c ./config/staging.json -l warn
```

### Config file formats

The `--config` path may point to any of the following file types:

| Extension | Format |
|-----------|--------|
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
  "forwardIp": true,
  "headers": {
    "response": { "X-Powered-By": "nrp" },
    "removeResponse": ["server"]
  },
  "routes": [
    {
      "match": "/api",
      "rewrite": { "stripPrefix": "/api" },
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

### Environment variables

Two environment variables can override values from the config file at startup.
Invalid values produce a warning and are ignored rather than causing an error.

| Variable   | Description                       | Validation                 |
|------------|-----------------------------------|----------------------------|
| `NRP_PORT` | Override the listening port       | Must be an integer 1-65535 |
| `NRP_HOST` | Override the binding host/address | Must be a non-empty string |

```bash
NRP_PORT=9090 NRP_HOST=127.0.0.1 nrp --config ./proxy.config.json
```

Environment variables take precedence over the config file.

---

## Programmatic API

### createProxy

Convenience factory that creates a `ProxyServer`, calls `listen()`, and returns it.

```ts
import { createProxy } from "@responsedotok/nrp";
import type { ConfigType, Hooks } from "@responsedotok/nrp";

const config: ConfigType = { port: 8080, routes: [...] };

const hooks: Hooks = {
  onRequest(ctx) {
    console.log(`→ ${ctx.req.method} ${ctx.req.url}`);
    return true; // return false to abort the request
  },
  onResponse(ctx, statusCode) {
    console.log(`← ${statusCode}`);
  },
  onError(err, ctx) {
    console.error(err.message, ctx.req?.url);
  },
};

const proxy = await createProxy(config, hooks);

// Graceful shutdown
process.on("SIGTERM", () => proxy.close());
```

### ProxyServer class

Use `ProxyServer` directly when you need more control over the server lifecycle.

```ts
import { ProxyServer } from "@responsedotok/nrp";

const server = new ProxyServer(config, hooks);

await server.listen(); // starts listening

// Access the raw http.Server — e.g. to attach Socket.IO
const httpServer = server.server;

await server.close(); // graceful shutdown
```

**`ProxyServer` API**

| Member                        | Type            | Description                                            |
|-------------------------------|-----------------|--------------------------------------------------------|
| `constructor(config, hooks?)` | —               | Create a proxy server                                  |
| `listen()`                    | `Promise<void>` | Start listening on `config.port` / `config.host`       |
| `close()`                     | `Promise<void>` | Stop accepting new connections and drain existing ones |
| `server`                      | `http.Server`   | The underlying `node:http` server instance             |

### Hooks

Hooks let you inspect and control the request lifecycle. All hooks are optional.

```ts
interface Hooks {
  onRequest?: (ctx: RequestContext) => boolean | Promise<boolean>;
  onResponse?: (ctx: Context, statusCode: number) => void | Promise<void>;
  onError?: (err: Error, ctx: Partial<Context>) => void;
}
```

#### `onRequest`

Called **before** the request is forwarded to the upstream. Return `false` to abort — no response is sent to the client so you must handle that yourself if needed.

```ts
onRequest({ req, route, upstream, targetPath }) {
  // Block requests without an auth header
  if (!req.headers["authorization"]) {
    return false;
  }
  return true;
}
```

| Context field | Type                   | Description                                   |
|---------------|------------------------|-----------------------------------------------|
| `req`         | `http.IncomingMessage` | Incoming client request                       |
| `route`       | `Route`                | The matched route                             |
| `upstream`    | `Upstream`             | The selected upstream server                  |
| `targetPath`  | `string`               | The rewritten path that will be sent upstream |

#### `onResponse`

Called **after** the upstream responds, before the response is streamed to the client.

```ts
onResponse({ req, upstream }, statusCode) {
  console.log(`← ${statusCode} ${req.url} → ${upstream.host}:${upstream.port}`);
}
```

| Parameter    | Type      | Description                                                  |
|--------------|-----------|--------------------------------------------------------------|
| `ctx`        | `Context` | Full request context (req, res, route, upstream, targetPath) |
| `statusCode` | `number`  | The upstream's HTTP status code                              |

#### `onError`

Called when an error occurs during proxying. The context may be partial if the error occurred before a route was matched.

```ts
onError(err, ctx) {
  console.error(`Proxy error: ${err.message}`, { url: ctx.req?.url });
}
```

---

## Config reference

### ConfigType

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | `number` | — | **Required.** Port to listen on |
| `host` | `string` | `"0.0.0.0"` | Address to bind |
| `routes` | `Route[]` | — | **Required.** Ordered route list — first match wins |
| `headers` | `HeaderRules` | — | Global header rules applied to all routes |
| `balancer` | `LoadBalancerStrategy` | `"round-robin"` | Default load-balancing strategy |
| `timeout` | `number` | `30000` | Upstream request timeout in milliseconds |
| `forwardIp` | `boolean` | `true` | Append `X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers |

### Route

| Field | Type | Description |
|-------|------|-------------|
| `match` | `string` or `(pathname: string) => boolean` | Prefix string or custom predicate function |
| `upstreams` | `Upstream[]` | **Required.** One or more target servers |
| `rewrite` | `RouteRewrite` | Path rewrite rules |
| `headers` | `HeaderRules` | Per-route header rules (merged with global) |
| `balancer` | `LoadBalancerStrategy` | Override the global balancer for this route |

### Upstream

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | `string` | — | **Required.** Hostname or IP address |
| `port` | `number` | — | **Required.** Port number |
| `protocol` | `"http"` or `"https"` | `"http"` | Protocol used to connect to the upstream |
| `weight` | `number` | `1` | Weight for the `"weighted"` balancer strategy |

### RouteRewrite

| Field | Type | Description |
|-------|------|-------------|
| `stripPrefix` | `string` | Remove this prefix from the incoming path |
| `addPrefix` | `string` | Prepend this to the (possibly stripped) path |
| `replacePath` | `string` | Replace the entire path — overrides `stripPrefix` and `addPrefix` |

Application order: `stripPrefix` → `addPrefix`. `replacePath` skips both.

### HeaderRules

| Field | Type | Description |
|-------|------|-------------|
| `request` | `Record<string, string>` | Set/override these headers on the forwarded request |
| `response` | `Record<string, string>` | Set/override these headers on the response to the client |
| `removeRequest` | `string[]` | Strip these headers from the forwarded request |
| `removeResponse` | `string[]` | Strip these headers from the response to the client |

### LoadBalancerStrategy

`"round-robin"` | `"random"` | `"weighted"`

---

## Routing

Routes are evaluated in order. The **first match wins**.

### String prefix matching

A string `match` value is treated as a path prefix.

| `match` value | Matches |
|---------------|---------|
| `"/"` | Everything (catch-all) |
| `"/api"` | `/api`, `/api/`, `/api/users`, `/api?q=1` |
| `"/api/v2"` | `/api/v2`, `/api/v2/users` — but **not** `/api/v1` |

Matching rules for a string `m`:

- Exact: `pathname === m`
- Sub-path: `pathname` starts with `m + "/"`
- Query: `pathname` starts with `m + "?"`

### Custom predicate matching

Pass a function for full control. Receives the raw pathname (no query string).

```ts
{
  match: (pathname) => /^\/api\/v[0-9]+/.test(pathname),
  upstreams: [{ host: "localhost", port: 3001 }],
}
```

> **Note:** Function-based matches cannot be expressed in JSON config files. Use a `.js`, `.mjs`, or `.ts` config for this feature.

### Match order

Place more specific routes **before** less specific ones. A `"/"` catch-all should always be last.

```json
[
  { "match": "/api/v2", "upstreams": [...] },
  { "match": "/api",    "upstreams": [...] },
  { "match": "/",       "upstreams": [...] }
]
```

---

## Path rewriting

The `rewrite` field controls which path is sent to the upstream.

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

---

## Header management

### Automatic processing

The following happen automatically on every request, regardless of config:

- **Hop-by-hop header stripping** — `connection`, `keep-alive`, `transfer-encoding`, `upgrade`, `proxy-authenticate`, `proxy-authorization`, `te`, and `trailer` are removed from both directions.
- **Host rewrite** — the `host` header is set to `upstream.host:upstream.port`.
- **X-Forwarded headers** (when `forwardIp: true`, the default):
  - `X-Forwarded-For` — appends the client IP (chains if already present)
  - `X-Forwarded-Host` — original `host` header from the client
  - `X-Forwarded-Proto` — protocol of the incoming connection (default: `"http"`)

### Global and per-route rules

Header rules at the top-level `headers` field apply to every route. Rules on a specific route are applied **in addition** to (not instead of) global rules, in order: global first, then route-level.

```json
{
  "headers": {
    "response": { "X-Powered-By": "nrp" },
    "removeResponse": ["server", "x-powered-by"]
  },
  "routes": [
    {
      "match": "/api",
      "headers": {
        "request":  { "X-Internal": "true" },
        "removeRequest": ["cookie"]
      },
      "upstreams": [{ "host": "localhost", "port": 3001 }]
    }
  ]
}
```

---

## Load balancing

Set `balancer` at the top level (global default) or per-route to override it.

### `"round-robin"` (default)

Distributes requests across upstreams in a repeating cycle.

```json
{ "balancer": "round-robin" }
```

### `"random"`

Selects an upstream at random for each request.

```json
{ "balancer": "random" }
```

### `"weighted"`

Selects upstreams probabilistically based on their `weight` value (default `1`).
An upstream with `weight: 2` receives roughly twice as many requests as one with `weight: 1`.

```json
{
  "balancer": "weighted",
  "upstreams": [
    { "host": "localhost", "port": 3001, "weight": 3 },
    { "host": "localhost", "port": 3002, "weight": 1 }
  ]
}
```

### Per-route override

```json
{
  "routes": [
    {
      "match": "/api",
      "balancer": "weighted",
      "upstreams": [
        { "host": "localhost", "port": 3001, "weight": 3 },
        { "host": "localhost", "port": 3002, "weight": 1 }
      ]
    }
  ]
}
```

---

## WebSocket proxying

WebSocket upgrade requests are tunneled transparently via raw TCP. Any route
whose `match` covers the upgrade path handles it automatically — no extra
configuration is needed.

```json
{
  "match": "/ws",
  "upstreams": [{ "host": "localhost", "port": 4000 }]
}
```

If no route matches a WebSocket upgrade, the connection is destroyed with a
`502 Bad Gateway` response.

---

## Logging

The CLI emits structured **newline-delimited JSON** on stdout (debug/info) and
stderr (warn/error). Pipe to a formatter such as
[`pino-pretty`](https://github.com/pinojs/pino-pretty) for human-readable output.

```bash
nrp --config ./proxy.config.json --log-level debug | npx pino-pretty
```

**Log levels** (in ascending order of severity):

| Level    | Value | Output |
|----------|-------|--------|
| `debug`  | 0     | stdout |
| `info`   | 1     | stdout |
| `warn`   | 2     | stderr |
| `error`  | 3     | stderr |
| `silent` | 4     | (none) |

Messages below the configured level are suppressed. Default level is `info`.

**Example log lines:**

```json
{"ts":"2026-03-25T12:00:00.000Z","level":"info","msg":"proxy listening","host":"0.0.0.0","port":8080}
{"ts":"2026-03-25T12:00:01.123Z","level":"debug","msg":"→ request","method":"GET","url":"/api/users","upstream":"localhost:3001","path":"/users"}
{"ts":"2026-03-25T12:00:01.145Z","level":"info","msg":"← response","statusCode":200,"url":"/api/users","upstream":"localhost:3001"}
{"ts":"2026-03-25T12:00:02.000Z","level":"error","msg":"upstream error","error":"ECONNREFUSED","url":"/api/down"}
```

---

## Building and publishing

```bash
# Install dependencies
npm install

# Type-check
npx tsc --noEmit

# Run tests
npm test -- --run

# Build (outputs to dist/)
npm run build

# Publish (runs build + tests automatically via prepublishOnly)
npm publish --access public
```

The build produces both **ESM** (`dist/*.mjs`) and **CommonJS** (`dist/cjs/*.js`) output, plus TypeScript declaration files.

---

## License

MIT
