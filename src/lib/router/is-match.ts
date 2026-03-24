import type { Route } from '@@/types/route.js';

/**
 * Compare a route's match criteria against a pathname to determine
 * if a given pathname matches the route's match criteria.
 * @param match 
 * @param pathname 
 * @returns True if the pathname matches the route's match criteria, otherwise false.
 */
export function isMatch(match: Route["match"], pathname: string): boolean {
  if (typeof match === "function") return match(pathname);
  // "/" is a universal catch-all
  if (match === "/") return true;
  // Prefix match: exact, or followed by "/" or "?"
  return pathname === match || pathname.startsWith(`${match}/`) || pathname.startsWith(`${match}?`);
}
