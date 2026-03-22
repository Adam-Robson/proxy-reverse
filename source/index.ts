import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { ProxyConfig } from "./core/types.js";
import { createProxy } from "./core/proxy-server.js";

const DEFAULT_CONFIG_PATH = "./proxy.config.json";

async function loadConfig(file = DEFAULT_CONFIG_PATH): Promise<ProxyConfig> {
	try {
		const resolved = path.resolve(file);
		const raw = await fs.readFile(resolved, "utf8");
		return JSON.parse(raw) as ProxyConfig;
	} catch (err) {
		// Fall back to a minimal default so the binary is usable out-of-the-box
		return {
			port: 8080,
			routes: [
				{
					match: "/",
					upstreams: [{ host: "localhost", port: 3000 } as any],
				} as any,
			],
		} as ProxyConfig;
	}
}

async function main(): Promise<void> {
	const cfgPath = process.argv[2] ?? DEFAULT_CONFIG_PATH;
	const config = await loadConfig(cfgPath);

	const server = await createProxy(config).catch((err) => {
		console.error("Failed to start proxy:", err);
		process.exit(1);
	});

	console.log(`Proxy listening on ${config.host ?? "0.0.0.0"}:${config.port}`);

	for (const sig of ["SIGINT", "SIGTERM"] as const) {
		process.on(sig, async () => {
			console.log(`Received ${sig}, shutting down`);
			try {
				if (server) await server.close();
			} catch (e) {
				// ignore
			}
			process.exit(0);
		});
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
