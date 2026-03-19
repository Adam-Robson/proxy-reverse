# proxy-reverse

├── node_modules/
├── shutdown/
|   ├── utils/
|   |   ├── config-loader.ts
|   |   └── logger.ts
|   └──index.ts
├── src/
|   ├── cli/
|   |   └── index.ts
|   └── core/
│       ├── balancer.ts
│       ├── headers.ts
│       ├── http-handler.ts
│       ├── proxy-server.ts
│       ├── router.ts
│       ├── types.ts
│       └── ws-handler.ts
├──tests/
├   ├── balancer.test.ts
|   ├── proxy-server.test.ts
|   └── router.test.ts
├── biome.json
├── package-lock.json
├── package.json
├── README.md
└── tsconfig.json

## Node Reverse Proxy

A composable, zero-dependency reverse proxy for Node.js with:

- **Route matching** — prefix strings or custom predicate functions
- **Path rewriting** — strip prefix, add prefix, or full path replacement
- **Header manipulation** — set/remove request and response headers globally or per-route
- **WebSocket proxying** — transparent TCP tunnel for upgrade requests
- **Load balancing** — round-robin, random, or weighted strategies per-route

Works as a **programmatic library** or a **standalone CLI** (`nrp`).

---

## Install

```bash
npm install @your-scope/node-reverse-proxy
```

---

## CLI

```bash
npx nrp --config ./proxy.config.json
```

### Options

| Flag                  | Default               | Description                                   |
|-----------------------|-----------------------|-----------------------------------------------|
| `-c, --config <path>` | `./proxy.config.json` | Path to config file (`.json` or `.js`/`.mjs`) |
| `--log-level <level>` | `info`                | `debug`, `info`, `warn`, `error`, `silent`    |
| `-h, --help`          | —                     | Print help                                    |

Logs are structured JSON on stdout/stderr. Pipe to `pino-pretty` or similar.

### Config file

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

---

## Programmatic API

### Quick start

```ts
import { createProxy } from "@your-scope/node-reverse-proxy";

const proxy = await createProxy({
  port: 8080,
  routes: [
    {
      match: "/api",
      rewrite: { stripPrefix: "/api" },
      upstreams: [
        { host: "localhost", port: 3001 },
        { host: "localhost", port: 3002 },
      ],
    },
    {
      match: "/",
      upstreams: [{ host: "localhost", port: 3000 }],
    },
  ],
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await proxy.close();
});
```

### ProxyServer class

```ts
import { ProxyServer } from "@your-scope/node-reverse-proxy";

const server = new ProxyServer(config, {
  onRequest({ req, upstream, targetPath }) {
    console.log(`→ ${req.method} ${req.url} → ${upstream.host}:${upstream.port}${targetPath}`);
    return true; // return false to abort the request
  },
  onResponse(ctx, statusCode) {
    console.log(`← ${statusCode} ${ctx.req.url}`);
  },
  onError(err, ctx) {
    console.error(err.message, ctx.req?.url);
  },
});

await server.listen();

// Access the raw http.Server (e.g. to attach socket.io)
const httpServer = server.httpServer;
```

---

## Config reference

### `ProxyConfig`

| Field      | Type               | Default         | Description                          |
|------------|--------------------|-----------------|--------------------------------------|
| `port`     | `number`           | —               | Port to listen on                    |
| `host`     | `string`           | `"0.0.0.0"`     | Host to bind                         |
| `routes`   | `Route[]`          | —               | Ordered route list (first match wins)|
| `headers`  | `HeaderRules`      | —               | Global header rules                  |
| `balancer` | `BalancerStrategy` | `"round-robin"` | Default load-balancing strategy      |
| `timeout`  | `number`           | `30000`         | Upstream request timeout (ms)        |
| `forwardIp`| `boolean`          | `true`          | Append `X-Forwarded-For` header      |

### `Route`

| Field      | Type               | Description                                        |
|------------|--------------------|----------------------------------------------------|
| `match`    | `string            |  (path: string) => boolean`, Prefix string         |
| `upstreams`| `Upstream[]`       | One or more targets                                |
| `rewrite`  | `RouteRewrite`     | Path rewrite rules                                 |
| `headers`  | `HeaderRules`      | Per-route header rules (merged with global)        |
| `balancer` | `BalancerStrategy` | Override the global balancer for this route        |

### `Upstream`

| Field      | Type     | Default | Description                    |
|------------|----------|---------|--------------------------------|
| `host`     | `string` | —       | Hostname or IP                 |
| `port`     | `number` | —       | Port                           |
| `protocol` | `http(s)`| -       | Upstream  protocol             |
| `weight`   | `number` | `1`     | Weight for `weighted` strategy |

### `RouteRewrite`

Applied in order: `stripPrefix` → `addPrefix`. `replacePath` overrides both.

| Field         | Type     |                Description                   |
|---------------|----------|----------------------------------------------|
| `stripPrefix` | `string` | Remove this prefix from the path             |
| `addPrefix`   | `string` | Prepend this to the (possibly stripped) path |
| `replacePath` | `string` | Replace the entire path with this value      |

### `HeaderRules`

| Field            | Type                     | Description                             |
|------------------|--------------------------|-----------------------------------------|
| `request`        | `Record<string, string>` | Set these on the forwarded request      |
| `response`       | `Record<string, string>` | Set these on the response to the client |
| `removeRequest`  | `string[]`               | Strip these from the forwarded request  |
| `removeResponse` | `string[]`               | Strip these from the response           |

### `BalancerStrategy`

`"round-robin"` | `"random"` | `"weighted"`

---

## WebSocket

WebSocket connections are proxied transparently via raw TCP tunnel. Any route
whose `match` covers the upgrade URL will be used. No extra configuration needed.

```json
{ "match": "/ws", "upstreams": [{ "host": "localhost", "port": 4000 }] }
```

---

## Custom load balancer

Implement the `ILoadBalancer` interface to plug in your own strategy:

```ts
import { ProxyServer, type ILoadBalancer, type Upstream } from "@your-scope/node-reverse-proxy";

class StickyBalancer implements ILoadBalancer {
  pick(upstreams: Upstream[]): Upstream {
    // e.g. session-affinity logic
    return upstreams[0]!;
  }
}
```

---

## Publishing

```bash
# Update name in package.json first, then:
npm run build
npm publish --access public
```

---

## License

MIT
