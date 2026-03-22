import type { LoadBalancer } from "../types/load-balancer";
import type { LoadBalancerStrategy } from "../types/load-balancer-strategy";
import { RandomBalancer } from "./anatomy/random-balancer";
import { RoundRobinBalancer } from "./anatomy/round-robin-balancer";
import { WeightedBalancer } from "./anatomy/weighted-balancer";

export function createBalancer(strategy: LoadBalancerStrategy): LoadBalancer {
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
