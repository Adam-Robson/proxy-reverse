import type { LogLevel } from '@@/types/log-level.js'

export function parseArgs(argv: string[]): { config: string; logLevel: LogLevel; help: boolean; } {
  const args = argv.slice(2);
  let config = './proxy.config.json';
  let logLevel: LogLevel = 'info';
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--config' || arg === '-c') {
      config = args[++i] as string;
    } else if (arg === '--log-level' || arg === '-l') {
      logLevel = args[++i] as LogLevel;
    }
  }
  return { config, logLevel, help };
}

