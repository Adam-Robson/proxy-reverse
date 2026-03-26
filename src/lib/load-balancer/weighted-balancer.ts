import type { LoadBalancer } from '@@/types/load-balancer.js';
import type { Upstream } from '@@/types/upstream.js';

export class WeightedBalancer implements LoadBalancer {
  pick(upstreams: Upstream[]): Upstream {
    if (upstreams.length === 0) throw new Error("No upstreams available");

    const total = upstreams.reduce((sum, u) => sum + (u.weight ?? 1), 0);
    if (total <= 0) throw new Error("Weighted balancer requires at least one upstream with a positive weight");
    let threshold = Math.random() * total;

    for (const upstream of upstreams) {
      threshold -= upstream.weight ?? 1;
      if (threshold <= 0) return upstream;
    }

    // Fallback
    return upstreams[upstreams.length - 1] as Upstream;
  }
}
