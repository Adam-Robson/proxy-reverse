import type { LoadBalancer } from '@/lib/types/load-balancer';
import type { Upstream } from '@/lib/types/upstream';

export class WeightedBalancer implements LoadBalancer {
  pick(upstreams: Upstream[]): Upstream {
    if (upstreams.length === 0) throw new Error("No upstreams available");

    const total = upstreams.reduce((sum, u) => sum + (u.weight ?? 1), 0);
    let threshold = Math.random() * total;

    for (const upstream of upstreams) {
      threshold -= upstream.weight ?? 1;
      if (threshold <= 0) return upstream;
    }

    // Fallback (floating point edge case)
    return upstreams[upstreams.length - 1];
  }
}
