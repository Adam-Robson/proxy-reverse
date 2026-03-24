import type { HeaderRules } from '@@/types/header-rules.js';
import type { ServerResponse } from 'node:http';

/**
 * Apply response header rules before sending back to the client.
 * 
 * @param res The server response object.
 * @param globalRules The global header rules to apply.
 * @param routeRules The route-specific header rules to apply.
 * @returns void
 */

export function applyResponseHeaders(
  res: ServerResponse,
  globalRules: HeaderRules | undefined,
  routeRules: HeaderRules | undefined,
): void {
  // Remove headers listed for removal
  for (const key of [
    ...(globalRules?.removeResponse ?? []),
    ...(routeRules?.removeResponse ?? []),
  ]) {
    res.removeHeader(key);
  }

  // Set/override headers
  for (const rules of [globalRules?.response, routeRules?.response]) {
    if (!rules) continue;
    for (const [key, value] of Object.entries(rules)) {
      res.setHeader(key, value);
    }
  }
}
