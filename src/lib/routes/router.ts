import type { Route } from '@@/types/route'
import type { RouteRewrite } from '@@/types/route-rewrite'

/**
 * Find the first matching route for a given request path.
 * @param routes The list of routes to match against.
 * @param pathname The request path to match.
 * @returns The first matching route, or null if no match is found.
 *
 */
export function matchRoute(routes: Route[], pathname: string): Route | null {
  for (const route of routes) {
    if (isMatch(route.match, pathname)) return route;
  }
  return null;
}

/**
 * Compare a route's match criteria against a pathname to determine
 * if a given pathname matches the route's match criteria.
 * @param match 
 * @param pathname 
 * @returns True if the pathname matches the route's match criteria, otherwise false.
 */
function isMatch(match: Route["match"], pathname: string): boolean {
  if (typeof match === "function") return match(pathname);
  // "/" is a universal catch-all
  if (match === "/") return true;
  // Prefix match: exact, or followed by "/" or "?"
  return pathname === match || pathname.startsWith(`${match}/`) || pathname.startsWith(`${match}?`);
}

/**
 * Apply rewrite rules to apply the forwarded path name.
 * @param pathname The request path to rewrite.
 * @param rewrite The rewrite rules to apply.
 * @returns The rewritten path.
 */
export function rewritePath(pathname: string, rewrite?: RouteRewrite): string {
  if (!rewrite) return pathname;

  if (rewrite.replacePath !== undefined) return rewrite.replacePath;

  let result = pathname;

  if (rewrite.stripPrefix && result.startsWith(rewrite.stripPrefix)) {
    result = result.slice(rewrite.stripPrefix.length) || "/";
  }

  if (rewrite.addPrefix) {
    result = rewrite.addPrefix + result;
  }

  return result;
}
