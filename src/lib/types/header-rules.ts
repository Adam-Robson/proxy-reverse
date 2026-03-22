export interface HeaderRules {
  request?: Record<string, string>;
  response?: Record<string, string>;
  removeRequest?: string[];
  removeResponse?: string[];
}
