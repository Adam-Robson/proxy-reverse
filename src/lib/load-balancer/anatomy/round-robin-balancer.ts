import type { LoadBalancer } from '@/lib/types/load-balancer';
import type { Upstream } from '@/lib/types/upstream';


export class RoundRobinBalancer implements LoadBalancer {
  private counters = new Map<string, number>();

  pick(upstreams: Upstream[]): Upstream {
    if (upstreams.length === 0) throw new Error("No upstreams available");
    if (upstreams.length === 1) return upstreams[0];

    const key = upstreams.map((u) => `${u.host}:${u.port}`).join(",");
    const count = this.counters.get(key) ?? 0;
    const selected = upstreams[count % upstreams.length];
    this.counters.set(key, count + 1);
    return selected;
  }
}
