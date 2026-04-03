import { LEVELS, type LogLevel } from "../lib/types/log-level.js";

export class Logger {
	private readonly level: number;

	constructor(lvl: LogLevel = "info") {
		this.level = LEVELS[lvl];
	}

	debug(msg: string, meta?: Record<string, unknown>): void {
		this.emit("debug", msg, meta);
	}

	info(msg: string, meta?: Record<string, unknown>): void {
		this.emit("info", msg, meta);
	}

	warn(msg: string, meta?: Record<string, unknown>): void {
		this.emit("warn", msg, meta);
	}

	error(msg: string, meta?: Record<string, unknown>): void {
		this.emit("error", msg, meta);
	}

	private emit(
		level: LogLevel,
		msg: string,
		meta?: Record<string, unknown>,
	): void {
		if (LEVELS[level] < this.level) return;

		const line = JSON.stringify({
			ts: new Date().toISOString(),
			level,
			msg,
			...meta,
		});

		if (level === "error" || level === "warn") {
			process.stderr.write(`${line}\n`);
		} else {
			process.stdout.write(`${line}\n`);
		}
	}
}
