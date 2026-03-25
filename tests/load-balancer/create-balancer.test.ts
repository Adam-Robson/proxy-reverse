import { describe, expect, it } from 'vitest';
import { createBalancer } from '@@/load-balancer/create-balancer.js';
import { RandomBalancer } from '@@/load-balancer/random-balancer.js';
import { RoundRobinBalancer } from '@@/load-balancer/round-robin-balancer.js';
import { WeightedBalancer } from '@@/load-balancer/weighted-balancer.js';

describe('createBalancer', () => {
	it('creates a RoundRobinBalancer for "round-robin"', () => {
		expect(createBalancer('round-robin')).toBeInstanceOf(RoundRobinBalancer);
	});

	it('creates a RandomBalancer for "random"', () => {
		expect(createBalancer('random')).toBeInstanceOf(RandomBalancer);
	});

	it('creates a WeightedBalancer for "weighted"', () => {
		expect(createBalancer('weighted')).toBeInstanceOf(WeightedBalancer);
	});

	it('returns a new instance on each call', () => {
		expect(createBalancer('round-robin')).not.toBe(createBalancer('round-robin'));
	});
});
