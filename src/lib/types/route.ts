import type { HeaderRules } from '@@/types/header-rules';
import type { RouteMatch } from '@@/types/route-match';
import type { LoadBalancerStrategy } from '@/lib/types/load-balancer-strategy'
import type { RouteRewrite } from './route-rewrite';
import type { Upstream } from './upstream';

export interface Route {
  match: string | RouteMatch;
  upstreams: Upstream[];
  rewrite?: RouteRewrite;
  headers?: HeaderRules;
  balancer?: LoadBalancerStrategy;
}
