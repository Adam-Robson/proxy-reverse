import fs from "node:fs/promises";
import path from "node:path";
import type { ConfigType } from '@/lib/types/config';

function validate(configFile: unknown, source: string) {
  if (!configFile || typeof configFile !== 'object') {
    throw new Error(`Config in ${source} must be an object`);
  }

  const cfg = configFile as Partial<ConfigType>;

  if (typeof cfg.port !== 'number') {
    throw new Error(`Config in ${source} must have a numeric "port" property`);
  }

  if (!Array.isArray(cfg.routes) || cfg.routes.length === 0) {
    throw new Error(`Config in ${source} must have a non-empty "routes" array`);
  }

  for (const [i, rte] of cfg.routes.entries()) {
    if (!rte.match && rte.match !== '') {
      throw new Error(`Config in ${source} is required to have routes.match at index ${i}`);
    }
    if (!Array.isArray(rte.upstreams) || rte.upstreams.length === 0) {
      throw new Error(`Config in ${source} is required to have routes.upstreams at index ${i}`);
    }
    for (const [_, u] of rte.upstreams.entries()) {
      if (!u.host || typeof u.port !== 'number') {
        throw new Error(
          `Config in ${source} is required to have Number for port and String for host.`
        );
      }
    }
  }
  return cfg as ConfigType;

}


export async function loadConfig(filePath: string): Promise<ConfigType> {
  const absolutePath = path.resolve(filePath);
  const extension = path.extname(absolutePath).toLowerCase();
  let c: unknown;
  if (extension === '.json') {
    const contents = await fs.readFile(absolutePath, 'utf-8');
    c = JSON.parse(contents);
  } else if (extension === '.js' || extension === '.mjs' || extension === '.ts') {
    const module = await import(absolutePath) as { default?: ConfigType };
    c = module.default ?? module;
  } else if (extension === '.env') {
    const envConfig = await fs.readFile(absolutePath, 'utf-8');
    const parsed = Object.fromEntries(
      envConfig
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          const [key, ...rest] = line.split('=');
          return [key, rest.join('=')];
        })
    );
    c = parsed;
  } else {

    throw new Error(`Unsupported config file extension: ${extension}`);
  }
  return validate(c, filePath)
}

export class Config {
  [key: string]: unknown

  constructor(data: ConfigType) {
    const validated = validate(data, 'Config.constructor');
    Object.assign(this, validated);
  }

  static async fromFile(filePath: string): Promise<Config> {
    const obj = await loadConfig(filePath);
    return new Config(obj);
  }
}


