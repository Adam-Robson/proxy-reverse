#!/usr/bin/env node

import { parseArgs } from '@/cli/parse-args.js';
import { printHelp } from '@/cli/print-help.js';
import process from 'node:process';
import { loadConfig } from './config/config.js';
import { ProxyServer } from './lib/proxy/proxy-server.js';
import type { ConfigType } from './lib/types/config.js';
import { Logger } from './logger/logger.js';

async function main(): Promise<void> {
  const { config: configPath, logLevel, help } = parseArgs(process.argv);

  if (help) {
    printHelp();
    process.exit(0);
  }

  const logger = new Logger(logLevel);

  let config: ConfigType;

  try {
    config = await loadConfig(configPath);
    logger.info('Configuration loaded successfully', { path: configPath });
  } catch (error) {
    logger.error('Failed to load configuration', { path: configPath, error });
    process.exit(1);
  }

  const server = new ProxyServer(config, {
    onRequest({ req, upstream, targetPath }) {
      logger.debug('→ request', {
        method: req.method,
        url: req.url,
        upstream: `${upstream.host}:${upstream.port}`,
        path: targetPath
      });
      return true;
    },
    onResponse(ctx, statusCode) {
      logger.info('← response', {
        statusCode,
        url: ctx.req.url,
        method: ctx.req.method,
        upstream: `${ctx.upstream.host}:${ctx.upstream.port}`,
        path: ctx.targetPath
      });
    },
    onError(error, ctx) {
      logger.error('✗ proxy error', {
        error: error.message,
        url: ctx?.req?.url,
        method: ctx?.req?.method,
        upstream: ctx?.upstream ? `${ctx.upstream.host}:${ctx.upstream.port}` : undefined,
        path: ctx?.targetPath
      });
    }
  });
  await server.listen();
  logger.info('Proxy listening', {
    port: config.port,
    host: config.host ?? '0.0.0.0',
    routes: config.routes.length
  });

  // graceful shutdown
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, async () => {
      logger.info(`Received ${sig}, shutting down...`);
      await server.close();
      process.exit(0);
    });
  }
  
}

main().catch((error) => {
  console.error(`Unhandled error in main ${error}`);
  process.exit(1);
});
