import type { Upstream } from "./upstream.js";

export interface LoadBalancer {
	pick(upstreams: Upstream[]): Upstream;
}
