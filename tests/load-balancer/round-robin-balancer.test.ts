import { RoundRobinBalancer } from "@@/load-balancer/round-robin-balancer.js";
import type { Upstream } from "@@/types/upstream.js";
import { describe, expect, it } from "vitest";

const a: Upstream = { host: "a", port: 1 };
const b: Upstream = { host: "b", port: 2 };
const c: Upstream = { host: "c", port: 3 };

describe("RoundRobinBalancer", () => {
	it("throws when upstreams is empty", () => {
		expect(() => new RoundRobinBalancer().pick([])).toThrow();
	});

	it("always returns the only upstream for a single-item list", () => {
		const balancer = new RoundRobinBalancer();
		expect(balancer.pick([a])).toBe(a);
		expect(balancer.pick([a])).toBe(a);
	});

	it("cycles through upstreams in order", () => {
		const balancer = new RoundRobinBalancer();
		const upstreams = [a, b, c];
		expect(balancer.pick(upstreams)).toBe(a);
		expect(balancer.pick(upstreams)).toBe(b);
		expect(balancer.pick(upstreams)).toBe(c);
		expect(balancer.pick(upstreams)).toBe(a);
	});

	it("wraps back to start after exhausting the list", () => {
		const balancer = new RoundRobinBalancer();
		const upstreams = [a, b];
		for (let i = 0; i < 6; i++) balancer.pick(upstreams);
		expect(balancer.pick(upstreams)).toBe(a);
	});

	it("maintains separate counters per distinct upstream set", () => {
		const balancer = new RoundRobinBalancer();
		const set1 = [
			{ host: "x", port: 1 },
			{ host: "y", port: 2 },
		];
		const set2 = [
			{ host: "m", port: 10 },
			{ host: "n", port: 20 },
		];
		expect(balancer.pick(set1)).toBe(set1[0]);
		expect(balancer.pick(set2)).toBe(set2[0]);
		expect(balancer.pick(set1)).toBe(set1[1]);
		expect(balancer.pick(set2)).toBe(set2[1]);
	});
});
