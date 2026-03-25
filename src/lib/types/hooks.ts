import type { Context } from '@@/types/context.js';

/**
 * Hooks for the reverse proxy server.
 * 
 * @property {function} [onRequest] - Called before the request is proxied. Return false to cancel the request.
 * @property {function} [onResponse] - Called after the response is received from the upstream server.
 * @property {function} [onError] - Called when an error occurs during request processing.
 *
 */
export interface Hooks {
  onRequest?: (ctx: Omit<Context, "res">) => boolean | Promise<boolean>;
  onResponse?: (ctx: Context, statusCode: number) => void | Promise<void>;
  onError?: (err: Error, ctx: Partial<Context>) => void;
}
