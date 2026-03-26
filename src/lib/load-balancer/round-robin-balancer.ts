import type { LoadBalancer } from '@@/types/load-balancer.js';
import type { Upstream } from '@@/types/upstream.js';

export class RoundRobinBalancer implements LoadBalancer {
  private counters = new Map<string, number>();
  
  pick(upstreams: Upstream[]): Upstream {
    if (upstreams.length === 0) {
      throw new Error("No upstream servers available.")
    }
    if (upstreams.length === 1) {
      return upstreams[0] as Upstream;
    }
    const key = upstreams.map((u) => `${u.host}:${u.port}`).join(",");
    const count = this.counters.get(key) ?? 0;
    const selected = upstreams[count % upstreams.length] as Upstream;

    this.counters.set(key, (count + 1) % upstreams.length);
    return selected; 
  }
}


