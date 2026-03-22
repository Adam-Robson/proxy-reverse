import type { Upstream } from '@/lib/types/upstream';

export interface LoadBalancer {
  pick(upstreams: Upstream[]): Upstream;
}
