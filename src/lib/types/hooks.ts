import type { Context } from '@/lib/types/context';

export interface Hooks {
  onRequest?: (ctx: Omit<Context, "res">) => boolean | Promise<boolean>;
  onResponse?: (ctx: Context, statusCode: number) => void | Promise<void>;
  onError?: (err: Error, ctx: Partial<Context>) => void;
}
