import type { Route } from '@/lib/types/route';
import type { HeaderRules } from './header-rules';
import type { LoadBalancerStrategy } from './load-balancer-strategy';

export interface ProxyConfig {
  port: number;
  host?: string;
  routes: Route[];
  headers?: HeaderRules;
  balancer?: LoadBalancerStrategy;
  timeout?: number;
  forwardIp?: boolean;
}
