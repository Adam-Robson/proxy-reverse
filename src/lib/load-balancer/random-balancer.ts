import type { LoadBalancer } from "../types/load-balancer.js";
import type { Upstream } from "../types/upstream.js";

export class RandomBalancer implements LoadBalancer {
	pick(upstreams: Upstream[]): Upstream {
		if (upstreams.length === 0) {
			throw new Error("No upstream servers available.");
		}
		const idx = Math.floor(Math.random() * upstreams.length);
		return upstreams[idx] as Upstream;
	}
}
