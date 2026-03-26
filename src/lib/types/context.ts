import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Route } from './route.js';
import type { Upstream } from './upstream.js';

export interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  route: Route;
  upstream: Upstream;
  targetPath: string;
}
  