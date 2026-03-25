import { afterEach, describe, expect, it, vi } from 'vitest';
import { RandomBalancer } from '@@/load-balancer/random-balancer.js';
import type { Upstream } from '@@/types/upstream.js';

const upstreams: Upstream[] = [
	{ host: 'a', port: 1 },
	{ host: 'b', port: 2 },
	{ host: 'c', port: 3 },
];

describe('RandomBalancer', () => {
	afterEach(() => vi.restoreAllMocks());

	it('throws when upstreams is empty', () => {
		expect(() => new RandomBalancer().pick([])).toThrow();
	});

	it('always returns a member of the upstreams list', () => {
		const balancer = new RandomBalancer();
		for (let i = 0; i < 20; i++) {
			expect(upstreams).toContain(balancer.pick(upstreams));
		}
	});

	it('selects the first upstream when Math.random returns 0', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		expect(new RandomBalancer().pick(upstreams)).toBe(upstreams[0]);
	});

	it('selects the last upstream when Math.random returns just below 1', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.999);
		expect(new RandomBalancer().pick(upstreams)).toBe(upstreams[2]);
	});
});
