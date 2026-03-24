import { RandomBalancer } from '@/lib/load-balancer/random-balancer.js';
import { RoundRobinBalancer } from '@/lib/load-balancer/round-robin-balancer.js';
import { WeightedBalancer } from '@/lib/load-balancer/weighted-balancer.js';
import type { LoadBalancerStrategy } from '@@/types/load-balancer-strategy.js';
import type { LoadBalancer } from '@@/types/load-balancer.js';

/**
 * Factory function to create a load balancer based on the given strategy.
 * @param strategy The load balancing strategy to use.
 * @returns An instance of a load balancer implementing the specified strategy.
 */
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
