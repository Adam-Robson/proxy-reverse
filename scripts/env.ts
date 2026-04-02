/**
 * Reads NRP_* environment variables and returns any valid overrides.
 * Invalid values are logged as warnings and ignored rather than throwing.
 * Supported variables:
 *   NRP_PORT   — override config.port   (must parse as a positive integer)
 *   NRP_HOST   — override config.host
 */
import type { ConfigType } from "../src/lib/types/config.js";

export interface EnvOverrides {
	port?: number;
	host?: string;
}

/**
 * Reads NRP_* environment variables and returns any valid overrides.
 * Invalid values are logged as warnings and ignored rather than throwing.
 * @returns An object containing any valid environment variable overrides.
 */
export function readEnvOverrides(): EnvOverrides {
	const overrides: EnvOverrides = {};
	const warnings: string[] = [];

	const rawPort = process.env.NRP_PORT;
	if (rawPort !== undefined) {
		const parsed = Number.parseInt(rawPort, 10);
		if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
			warnings.push(
				`NRP_PORT="${rawPort}" is not a valid port number (1–65535) — ignoring`,
			);
		} else {
			overrides.port = parsed;
		}
	}

	const rawHost = process.env.NRP_HOST;
	if (rawHost !== undefined) {
		if (rawHost.trim() === "") {
			warnings.push(`NRP_HOST is set but empty — ignoring`);
		} else {
			overrides.host = rawHost.trim();
		}
	}

	for (const w of warnings) {
		process.stderr.write(`[nrp] warn: ${w}\n`);
	}

	return overrides;
}

/**
 *  Applies environment variable overrides to a given ConfigType object.
 *  Returns a new object with the overrides applied, without mutating the original config.
 * @param config The original ConfigType object.
 * @param overrides The environment variable overrides to apply.
 * @returns A new ConfigType object with the overrides applied.
 */
export function applyEnvOverrides(
	config: ConfigType,
	overrides: EnvOverrides,
): ConfigType {
	if (Object.keys(overrides).length === 0) return config;
	return { ...config, ...overrides };
}
