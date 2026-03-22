import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Route } from './route';
import type { Upstream } from './upstream';
export interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  route: Route;
  upstream: Upstream;
  targetPath: string;
}
  