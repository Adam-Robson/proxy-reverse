import type { Upstream } from "@@/types/upstream.js";
import net from "node:net";

/**
 * Periodically probes upstream servers via TCP and tracks which ones are reachable.
 * All upstreams start as healthy and are only marked unhealthy after a failed probe.
 */
export class HealthMonitor {
	private readonly unhealthy = new Set<string>();
	private readonly timers: ReturnType<typeof setInterval>[] = [];

	constructor(
		private readonly upstreams: Upstream[],
		private readonly intervalMs = 30_000,
		private readonly timeoutMs = 5_000,
	) {}

	start(): void {
		for (const upstream of this.upstreams) {
			this.probe(upstream);
			const timer = setInterval(() => this.probe(upstream), this.intervalMs);
			timer.unref();
			this.timers.push(timer);
		}
	}

	stop(): void {
		for (const timer of this.timers) clearInterval(timer);
		this.timers.length = 0;
	}

	isHealthy(upstream: Upstream): boolean {
		return !this.unhealthy.has(this.key(upstream));
	}

	private key(upstream: Upstream): string {
		return `${upstream.host}:${upstream.port}`;
	}

	private probe(upstream: Upstream): void {
		const key = this.key(upstream);
		const socket = net.createConnection({
			host: upstream.host,
			port: upstream.port,
		});
		socket.setTimeout(this.timeoutMs);
		socket.on("connect", () => {
			this.unhealthy.delete(key);
			socket.destroy();
		});
		socket.on("error", () => {
			this.unhealthy.add(key);
		});
		socket.on("timeout", () => {
			this.unhealthy.add(key);
			socket.destroy();
		});
	}
}
