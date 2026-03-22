import type { Route, RouteRewrite } from "./types.js";

/**
 * Find the first matching route for a given pathname.
 * Routes are checked in declaration order — first match wins.
 */
export function matchRoute(routes: Route[], pathname: string): Route | null {
  for (const route of routes) {
    if (isMatch(route.match, pathname)) return route;
  }
  return null;
}

function isMatch(match: Route["match"], pathname: string): boolean {
  if (typeof match === "function") return match(pathname);
  // "/" is a universal catch-all
  if (match === "/") return true;
  // Prefix match: exact, or followed by "/" or "?"
  return pathname === match || pathname.startsWith(`${match}/`) || pathname.startsWith(`${match}?`);
}

/**
 * Apply rewrite rules to produce the forwarded path.
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
