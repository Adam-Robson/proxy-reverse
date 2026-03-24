import type { Upstream } from '@@/types/upstream.js';

export interface LoadBalancer {
  pick(upstreams: Upstream[]): Upstream
}
