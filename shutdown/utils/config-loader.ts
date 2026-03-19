import fs from "node:fs/promises";
import path from "node:path";
import type { ProxyConfig } from "../core/types.js";

type RawConfig = ProxyConfig;

/**
 * Load and validate a proxy config from a JSON file.
 * Supports .json and .js (ESM dynamic import) files.
 */
export async function loadConfig(filePath: string): Promise<ProxyConfig> {
  const resolved = path.resolve(filePath);
  const ext = path.extname(resolved);

  let raw: unknown;

  if (ext === ".json") {
    const contents = await fs.readFile(resolved, "utf-8");
    raw = JSON.parse(contents);
  } else if (ext === ".js" || ext === ".mjs" || ext === ".ts") {
    const mod = await import(resolved) as { default?: unknown };
    raw = mod.default ?? mod;
  } else {
    throw new Error(`Unsupported config format: ${ext}`);
  }

  return validate(raw, filePath);
}

function validate(raw: unknown, source: string): ProxyConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Config in ${source} must be an object`);
  }

  const cfg = raw as Partial<RawConfig>;

  if (typeof cfg.port !== "number") {
    throw new Error(`Config.port must be a number (got ${typeof cfg.port})`);
  }

  if (!Array.isArray(cfg.routes) || cfg.routes.length === 0) {
    throw new Error("Config.routes must be a non-empty array");
  }

  for (const [i, route] of cfg.routes.entries()) {
    if (!route.match && route.match !== "") {
      throw new Error(`routes[${i}].match is required`);
    }
    if (!Array.isArray(route.upstreams) || route.upstreams.length === 0) {
      throw new Error(`routes[${i}].upstreams must be a non-empty array`);
    }
    for (const [j, u] of route.upstreams.entries()) {
      if (!u.host || typeof u.port !== "number") {
        throw new Error(`routes[${i}].upstreams[${j}] must have host (string) and port (number)`);
      }
    }
  }

  return cfg as ProxyConfig;
}
