import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeightedBalancer } from '@@/load-balancer/weighted-balancer.js';
import type { Upstream } from '@@/types/upstream.js';

describe('WeightedBalancer', () => {
	afterEach(() => vi.restoreAllMocks());

	it('throws when upstreams is empty', () => {
		expect(() => new WeightedBalancer().pick([])).toThrow();
	});

	it('always returns the only upstream', () => {
		const upstream: Upstream = { host: 'a', port: 1, weight: 10 };
		expect(new WeightedBalancer().pick([upstream])).toBe(upstream);
	});

	it('selects the heavy upstream when random lands in its range', () => {
		// weights: a=3, b=1 → total=4
		// random=0.1 → threshold=0.4, subtract 3 → -2.6 ≤ 0 → a
		const upstreams: Upstream[] = [
			{ host: 'a', port: 1, weight: 3 },
			{ host: 'b', port: 2, weight: 1 },
		];
		vi.spyOn(Math, 'random').mockReturnValue(0.1);
		expect(new WeightedBalancer().pick(upstreams)).toBe(upstreams[0]);
	});

	it('selects the light upstream when random lands in its range', () => {
		// weights: a=3, b=1 → total=4
		// random=0.9 → threshold=3.6, subtract 3 → 0.6 > 0, subtract 1 → -0.4 ≤ 0 → b
		const upstreams: Upstream[] = [
			{ host: 'a', port: 1, weight: 3 },
			{ host: 'b', port: 2, weight: 1 },
		];
		vi.spyOn(Math, 'random').mockReturnValue(0.9);
		expect(new WeightedBalancer().pick(upstreams)).toBe(upstreams[1]);
	});

	it('defaults to weight 1 when weight is not specified', () => {
		// equal weights → random=0 → first upstream
		const upstreams: Upstream[] = [
			{ host: 'a', port: 1 },
			{ host: 'b', port: 2 },
		];
		vi.spyOn(Math, 'random').mockReturnValue(0);
		expect(new WeightedBalancer().pick(upstreams)).toBe(upstreams[0]);
	});
});
