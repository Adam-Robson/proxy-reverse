import type { LogLevel } from "../lib/types/log-level.js";

export function parseArgs(argv: string[]): {
	config: string;
	logLevel: LogLevel;
	help: boolean;
} {
	const args = argv.slice(2);
	let config = "./proxy.config.json";
	let logLevel: LogLevel = "info";
	let help = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--help" || arg === "-h") {
			help = true;
		} else if (arg === "--config" || arg === "-c") {
			if (i + 1 >= args.length) throw new Error(`Missing value for ${arg}`);
			config = args[++i] as string;
		} else if (arg === "--log-level" || arg === "-l") {
			if (i + 1 >= args.length) throw new Error(`Missing value for ${arg}`);
			logLevel = args[++i] as LogLevel;
		}
	}
	return { config, logLevel, help };
}
