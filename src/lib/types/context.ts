import type { IncomingMessage, ServerResponse } from "node:http";
import type { Route } from "@/lib/types/route";
import type { Upstream } from '@/lib/types/upstream';

export interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  route: Route;
  upstream: Upstream;
  targetPath: string;
}
