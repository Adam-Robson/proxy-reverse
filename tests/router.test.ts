import { describe, it, expect } from "vitest";
import { matchRoute, rewritePath } from "../src/core/router.js";
import type { Route } from "../src/core/types.js";

const upstream = { host: "localhost", port: 3000 };

const makeRoute = (match: Route["match"]): Route => ({
  match,
  upstreams: [upstream],
});

describe("matchRoute", () => {
  it("matches by string prefix", () => {
    const routes = [makeRoute("/api"), makeRoute("/")];
    expect(matchRoute(routes, "/api/users")?.match).toBe("/api");
    expect(matchRoute(routes, "/other")?.match).toBe("/");
  });

  it("returns first match only (route priority)", () => {
    const routes = [makeRoute("/api"), makeRoute("/api/admin")];
    expect(matchRoute(routes, "/api/admin")?.match).toBe("/api");
  });

  it("matches exact path", () => {
    const routes = [makeRoute("/health")];
    expect(matchRoute(routes, "/health")).not.toBeNull();
    expect(matchRoute(routes, "/healthz")).toBeNull();
  });

  it("matches by custom function", () => {
    const routes = [makeRoute((p) => p.endsWith(".json"))];
    expect(matchRoute(routes, "/data/foo.json")).not.toBeNull();
    expect(matchRoute(routes, "/data/foo.html")).toBeNull();
  });

  it("returns null when no route matches", () => {
    const routes = [makeRoute("/api")];
    expect(matchRoute(routes, "/other")).toBeNull();
  });
});

describe("rewritePath", () => {
  it("returns path unchanged when no rewrite", () => {
    expect(rewritePath("/api/users")).toBe("/api/users");
  });

  it("strips prefix", () => {
    expect(rewritePath("/api/users", { stripPrefix: "/api" })).toBe("/users");
  });

  it("strips prefix leaving root slash when path equals prefix", () => {
    expect(rewritePath("/api", { stripPrefix: "/api" })).toBe("/");
  });

  it("adds prefix", () => {
    expect(rewritePath("/users", { addPrefix: "/v1" })).toBe("/v1/users");
  });

  it("strips then adds prefix", () => {
    expect(rewritePath("/api/users", { stripPrefix: "/api", addPrefix: "/v2" })).toBe("/v2/users");
  });

  it("replaces entire path", () => {
    expect(rewritePath("/anything", { replacePath: "/health" })).toBe("/health");
  });
});
