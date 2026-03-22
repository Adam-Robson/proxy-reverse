import type { HeaderRules } from '@@/types/header-rules';
import type { LoadBalancerStrategy } from "@@/types/load-balancer-strategy";
import type { Route } from "@@/types/route";

/**
 * Configuration for the reverse proxy server.
 * 
 * @property {number} port - Port the proxy server listens on (default: 8080)
 * @property {string} [host] - Host the proxy server listens on (default: "0.0.0.0")
 * @property {Route[]} routes - Ordered list of route definitions
 * @property {HeaderRules} [headers] - Global header rules applied to every request/response
 * @property {LoadBalancerStrategy} [balancer] - Default load-balancing strategy (default: "round-robin")
 * @property {number} [timeout] - Proxy request timeout in ms (default: 30_000)
 * @property {boolean} [forwardIp] - Forward the client's IP via X-Forwarded-For (default: true)
 * 
 */

export interface ConfigType {
  port: number;
  host?: string;
  routes: Route[];
  headers?: HeaderRules;
  balancer?: LoadBalancerStrategy;
  timeout?: number;
  forwardIp?: boolean;
}
