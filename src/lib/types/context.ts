import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Route } from './route';
import type { Upstream } from './upstream';

/**
 * Context for a single request being processed by the reverse proxy.
 * 
 * @property {IncomingMessage} req - The incoming HTTP request object
 * @property {ServerResponse} res - The outgoing HTTP response object
 * @property {Route} route - The matched route for this request
 * @property {Upstream} upstream - The selected upstream server for this request
 * @property {string} targetPath - The path on the upstream server to which the request will be proxied
 *
 */
export interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  route: Route;
  upstream: Upstream;
  targetPath: string;
}
  