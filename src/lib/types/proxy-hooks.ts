import type { ProxyContext } from '@/lib/types/proxy-context';

export interface ProxyHooks {
  onRequest?: (ctx: Omit<ProxyContext, "res">) => boolean | Promise<boolean>;
  onResponse?: (ctx: ProxyContext, statusCode: number) => void | Promise<void>;
  onError?: (err: Error, ctx: Partial<ProxyContext>) => void;
}
