import { applyHeaderRules } from "@/lib/headers/apply-header-rules.js";
import { buildRequestHeaders } from '@/lib/headers/build-request-headers.js';
import type { HeaderRules } from "@@/types/header-rules.js";
import type { IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders } from "node:http";

export class Headers {

  private headers: IncomingHttpHeaders | OutgoingHttpHeaders;

  constructor(headers: IncomingHttpHeaders | OutgoingHttpHeaders) {
    this.headers = { ...headers } as IncomingHttpHeaders | OutgoingHttpHeaders;
  }

  getHeaders(): IncomingHttpHeaders | OutgoingHttpHeaders {
    return this.headers;
  }

  setHeaders(headers: IncomingHttpHeaders | OutgoingHttpHeaders): void {
    this.headers = headers;
  }

  applyHeaderRules(rules: HeaderRules | null, direction: 'request' | 'response'): void {
    applyHeaderRules(this.headers, rules, direction);
  }

  applyResponseHeaders(rules: HeaderRules | null): void {
    this.applyHeaderRules(rules, 'response');
  }
  
  buildRequestHeaders(
    req: IncomingMessage,
    globalRules: HeaderRules | null,
    routeRules: HeaderRules | null,
    upstream: { host: string, port: number},
    forwardIp: boolean
  ): OutgoingHttpHeaders {
      const out = buildRequestHeaders(req, globalRules, routeRules, upstream, forwardIp);
      this.headers = out;
      return out;
  }
}
