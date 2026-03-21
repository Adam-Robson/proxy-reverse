import type { BalancerStrategy, Upstream } from "./types.js";

// ── ILoadBalancer interface (Open/Closed: extend without modifying) ───────────

export interface ILoadBalancer {
  pick(upstreams: Upstream[]): Upstream;
}

// ── Concrete strategies ───────────────────────────────────────────────────────

export class RoundRobinBalancer implements ILoadBalancer {
  private counters = new Map<string, number>();

  pick(upstreams: Upstream[]): Upstream {
    if (upstreams.length === 0) throw new Error("No upstreams available");
    if (upstreams.length === 1) return upstreams[0]!;

    const key = upstreams.map((u) => `${u.host}:${u.port}`).join(",");
    const count = this.counters.get(key) ?? 0;
    const selected = upstreams[count % upstreams.length]!;
    this.counters.set(key, count + 1);
    return selected;
  }
}

export class RandomBalancer implements ILoadBalancer {
  pick(upstreams: Upstream[]): Upstream {
    if (upstreams.length === 0) throw new Error("No upstreams available");
    const idx = Math.floor(Math.random() * upstreams.length);
    return upstreams[idx]!;
  }
}

export class WeightedBalancer implements ILoadBalancer {
  pick(upstreams: Upstream[]): Upstream {
    if (upstreams.length === 0) throw new Error("No upstreams available");

    const total = upstreams.reduce((sum, u) => sum + (u.weight ?? 1), 0);
    let threshold = Math.random() * total;

    for (const upstream of upstreams) {
      threshold -= upstream.weight ?? 1;
      if (threshold <= 0) return upstream;
    }

    // Fallback (floating point edge case)
    return upstreams[upstreams.length - 1]!;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createBalancer(strategy: BalancerStrategy): ILoadBalancer {
  switch (strategy) {
    case "round-robin":
      return new RoundRobinBalancer();
    case "random":
      return new RandomBalancer();
    case "weighted":
      return new WeightedBalancer();
    default: {
      const exhaustive: never = strategy;
      throw new Error(`Unknown balancer strategy: ${exhaustive}`);
    }
  }
}
