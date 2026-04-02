import { describe, expect, it } from "vitest";
import { parseArgs } from "@/cli/parse-args.js";

const base = ["node", "script"];

describe("parseArgs", () => {
	it("returns defaults when no args are provided", () => {
		const result = parseArgs(base);
		expect(result.config).toBe("./proxy.config.json");
		expect(result.logLevel).toBe("info");
		expect(result.help).toBe(false);
	});

	it("parses --config", () => {
		expect(parseArgs([...base, "--config", "my.json"]).config).toBe("my.json");
	});

	it("parses -c shorthand", () => {
		expect(parseArgs([...base, "-c", "my.json"]).config).toBe("my.json");
	});

	it("parses --log-level", () => {
		expect(parseArgs([...base, "--log-level", "debug"]).logLevel).toBe("debug");
	});

	it("parses -l shorthand", () => {
		expect(parseArgs([...base, "-l", "warn"]).logLevel).toBe("warn");
	});

	it("parses --help", () => {
		expect(parseArgs([...base, "--help"]).help).toBe(true);
	});

	it("parses -h shorthand", () => {
		expect(parseArgs([...base, "-h"]).help).toBe(true);
	});

	it("parses multiple flags together", () => {
		const result = parseArgs([...base, "-c", "cfg.json", "-l", "error", "-h"]);
		expect(result.config).toBe("cfg.json");
		expect(result.logLevel).toBe("error");
		expect(result.help).toBe(true);
	});

	it("last --config value wins when specified multiple times", () => {
		expect(
			parseArgs([...base, "--config", "first.json", "--config", "second.json"])
				.config,
		).toBe("second.json");
	});
});
