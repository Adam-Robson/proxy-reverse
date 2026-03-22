import type { LoadBalancer } from '@/lib/types/load-balancer';
import type { Upstream } from '@/lib/types/upstream';


export class RandomBalancer implements LoadBalancer {
  pick(upstreams: Upstream[]): Upstream {
    if (upstreams.length === 0) throw new Error("No upstreams available");
    const idx = Math.floor(Math.random() * upstreams.length);
    return upstreams[idx];
  }
}
