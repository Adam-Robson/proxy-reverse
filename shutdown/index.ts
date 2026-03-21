#!/usr/bin/env node
import process from "node:process";
import { loadConfig } from "../utils/config-loader.js";
import { ProxyServer } from "../core/proxy-server.js";
import { Logger } from "../utils/logger.js";
import type { LogLevel } from "../utils/logger.js";

// ── Arg parsing (no deps — keeps the package lean) ───────────────────────────

function parseArgs(argv: string[]): { config: string; logLevel: LogLevel; help: boolean } {
  const args = argv.slice(2);
  let config = "./proxy.config.json";
  let logLevel: LogLevel = "info";
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
    } else if ((arg === "-c" || arg === "--config") && args[i + 1]) {
      config = args[++i]!;
    } else if ((arg === "--log-level") && args[i + 1]) {
      logLevel = args[++i] as LogLevel;
    }
  }

  return { config, logLevel, help };
}

function printHelp(): void {
  console.log(`
nrp — Node Reverse Proxy

USAGE
  nrp [options]

OPTIONS
  -c, --config <path>      Path to config file (default: ./proxy.config.json)
      --log-level <level>  Log level: debug | info | warn | error | silent (default: info)
  -h, --help               Show this help message

CONFIG FORMAT (proxy.config.json)
  {
    "port": 8080,
    "balancer": "round-robin",
    "headers": {
      "response": { "X-Powered-By": "nrp" }
    },
    "routes": [
      {
        "match": "/api",
        "rewrite": { "stripPrefix": "/api" },
        "upstreams": [
          { "host": "localhost", "port": 3001 },
          { "host": "localhost", "port": 3002 }
        ]
      },
      {
        "match": "/",
        "upstreams": [{ "host": "localhost", "port": 3000 }]
      }
    ]
  }

EXAMPLES
  nrp
  nrp --config ./config/dev.json --log-level debug
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { config: configPath, logLevel, help } = parseArgs(process.argv);

  if (help) {
    printHelp();
    process.exit(0);
  }

  const logger = new Logger(logLevel);

  let config;
  try {
    config = await loadConfig(configPath);
    logger.info("Config loaded", { path: configPath });
  } catch (err) {
    logger.error("Failed to load config", { error: (err as Error).message, path: configPath });
    process.exit(1);
  }

  const server = new ProxyServer(config, {
    onRequest({ req, upstream, targetPath }) {
      logger.debug("→ request", {
        method: req.method,
        url: req.url,
        upstream: `${upstream.host}:${upstream.port}`,
        path: targetPath,
      });
      return true;
    },
    onResponse(ctx, statusCode) {
      logger.info("← response", {
        method: ctx.req.method,
        url: ctx.req.url,
        status: statusCode,
        upstream: `${ctx.upstream.host}:${ctx.upstream.port}`,
      });
    },
    onError(err, ctx) {
      logger.error("Proxy error", {
        error: err.message,
        url: ctx.req?.url,
      });
    },
  });

  await server.listen();
  logger.info("Proxy listening", {
    port: config.port,
    host: config.host ?? "0.0.0.0",
    routes: config.routes.length,
  });

  // Graceful shutdown
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, async () => {
      logger.info(`Received ${sig}, shutting down...`);
      await server.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
