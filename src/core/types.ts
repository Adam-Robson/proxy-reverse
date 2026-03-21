import type { IncomingMessage, ServerResponse } from 'node:http'

export type RouteMatchFn = (pathname: string) => boolean;

export type BalancerStrategy = 'round-robin' | 'random' | 'weighted';

export interface RouteRewrite {
  stripPrefix?: string;
  addPrefix?: string;
  replacePath?: string;
}

export interface Upstream {
  host: string;
  port: number;
  protocol?: 'http' | 'https';
  weight?: number;
}

export interface HeaderRules {
  request?: Record<string, string>;
  response?: Record<string, string>;
  removeRequest?: string[];
  removeResponse?: string[]; 
}

export interface Route {
  match: string | RouteMatchFn;
  upstream?: Upstream[];
  rewrite?: RouteRewrite;
  headers?: HeaderRules;
  balancer?: BalancerStrategy;
}
 
export interface ProxyContext {
  req: IncomingMessage;
  res: ServerResponse;
  route: Route;
  upstream: Upstream;
  targetPath: string;
}

export interface ProxyConfig {
  port: number;
  host?: string;
  routes: Route[];
  headers?: HeaderRules;
  balancer?: BalancerStrategy;
  timeout?: number;
  forwardIp?: boolean;
}

export interface ProxyHooks {
  onRequest?: (ctx: Omit<ProxyContext, "res">) => boolean | Promise<boolean>;
  onResponse?: (ctx: ProxyContext, statusCode: number) => void | Promise<void>;
  onError?: (err: Error, ctx: Partial<ProxyContext>) => void;
}
