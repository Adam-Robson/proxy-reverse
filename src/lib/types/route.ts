import type { RouteMatch } from '@/lib/types/route-match';
import type { Upstream } from '@/lib/types/upstream';
import type { HeaderRules } from './header-rules';
import type { LoadBalancerStrategy } from './load-balancer-strategy';
import type { RouteRewrite } from './route-rewrite';


export interface Route {
  match: string | RouteMatch;
  upstream?: Upstream[];
  rewrite?: RouteRewrite;
  headers?: HeaderRules;
  balancer?: LoadBalancerStrategy;
}
