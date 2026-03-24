import { isMatch } from '@/lib/router/is-match.js';
import { matchRoute } from '@/lib/router/match-route.js';
import { rewritePath } from '@/lib/router/rewrite-path.js';
import type { RouteRewrite } from '@@/types/route-rewrite.js';
import type { Route } from '@@/types/route.js';


export class Router {
  private routes: Route[] = [];

  constructor(routes: Route[]) {
    this.routes = routes;
  }

  public isMatch(match: Route['match'], pathname: string): boolean {
    return isMatch(match, pathname);

  }

  public match(pathname: string): Route | null {
    return matchRoute(this.routes, pathname);
  }

  public rewrite(pathname: string, rewrite?: RouteRewrite): string {
    return rewritePath(pathname, rewrite);
  }

}

export { isMatch, matchRoute, rewritePath };
