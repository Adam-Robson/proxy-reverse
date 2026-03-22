import type { HeaderRules } from '@@/types/header-rules';
import type { RouteMatch } from '@@/types/route-match';
import type { LoadBalancerStrategy } from '@/lib/types/load-balancer-strategy'
import type { RouteRewrite } from './route-rewrite';
import type { Upstream } from './upstream';

/**
 * Route configuration for the reverse proxy server.
 * 
 * @interface Route
 * @property {string | RouteMatch} match - A string or function to determine if a request matches this route.
 * @property {Upstream[]} upstreams - A list of upstream servers to proxy requests to.
 * @property {RouteRewrite} [rewrite] - Optional rules to rewrite the request path before proxying.
 * @property {HeaderRules} [headers] - Optional rules to modify request and response headers.
 * @property {LoadBalancerStrategy} [balancer] - Optional load balancing strategy for distributing requests across upstreams.
 *
 */
export interface Route {
  match: string | RouteMatch;
  upstreams: Upstream[];
  rewrite?: RouteRewrite;
  headers?: HeaderRules;
  balancer?: LoadBalancerStrategy;
}
