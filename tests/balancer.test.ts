import { describe, expect, it } from "vitest";
import {
  createBalancer,
  RandomBalancer,
  RoundRobinBalancer,
  WeightedBalancer,
} from "../src/core/balancer.js";
import type { Upstream } from "../src/core/types.js";

const makeUpstreams = (n: number): Upstream[] =>
  Array.from({ length: n }, (_, i) => ({ host: "localhost", port: 3000 + i }));

describe("RoundRobinBalancer", () => {
  it("cycles through upstreams in order", () => {
    const b = new RoundRobinBalancer();
    const u = makeUpstreams(3);
    expect(b.pick(u).port).toBe(3000);
    expect(b.pick(u).port).toBe(3001);
    expect(b.pick(u).port).toBe(3002);
    expect(b.pick(u).port).toBe(3000);
  });

  it("returns the single upstream directly", () => {
    const b = new RoundRobinBalancer();
    const u = makeUpstreams(1);
    expect(b.pick(u).port).toBe(3000);
    expect(b.pick(u).port).toBe(3000);
  });

  it("throws on empty upstreams", () => {
    expect(() => new RoundRobinBalancer().pick([])).toThrow();
  });

  it("maintains independent counters per upstream set", () => {
    const b = new RoundRobinBalancer();
    const u2 = makeUpstreams(2);
    const u3 = makeUpstreams(3);
    b.pick(u2);
    b.pick(u2);
    // u3 is a different key — should start from 0
    expect(b.pick(u3).port).toBe(3000);
  });
});

describe("RandomBalancer", () => {
  it("always returns an upstream from the list", () => {
    const b = new RandomBalancer();
    const u = makeUpstreams(5);
    for (let i = 0; i < 50; i++) {
      const picked = b.pick(u);
      expect(u).toContain(picked);
    }
  });

  it("throws on empty upstreams", () => {
    expect(() => new RandomBalancer().pick([])).toThrow();
  });
});

describe("WeightedBalancer", () => {
  it("always returns an upstream from the list", () => {
    const b = new WeightedBalancer();
    const u: Upstream[] = [
      { host: "a", port: 1, weight: 10 },
      { host: "b", port: 2, weight: 1 },
    ];
    for (let i = 0; i < 100; i++) {
      expect(u).toContain(b.pick(u));
    }
  });

  it("heavily favours the high-weight upstream in distribution", () => {
    const b = new WeightedBalancer();
    const u: Upstream[] = [
      { host: "heavy", port: 1, weight: 99 },
      { host: "light", port: 2, weight: 1 },
    ];
    let heavy = 0;
    for (let i = 0; i < 1000; i++) {
      if (b.pick(u).host === "heavy") heavy++;
    }
    // With weight 99:1, expect >90% heavy picks across 1000 trials
    expect(heavy).toBeGreaterThan(900);
  });
});

describe("createBalancer factory", () => {
  it("creates round-robin balancer", () => {
    expect(createBalancer("round-robin")).toBeInstanceOf(RoundRobinBalancer);
  });
  it("creates random balancer", () => {
    expect(createBalancer("random")).toBeInstanceOf(RandomBalancer);
  });
  it("creates weighted balancer", () => {
    expect(createBalancer("weighted")).toBeInstanceOf(WeightedBalancer);
  });
  it("throws on unknown strategy", () => {
    // @ts-expect-error — intentional bad input
    expect(() => createBalancer("foobar")).toThrow();
  });
});
