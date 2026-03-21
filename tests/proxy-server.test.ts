import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProxyServer } from "../src/core/proxy-server.js";

// ── Minimal upstream server factory ──────────────────────────────────────────

function startUpstream(port: number, body: string, statusCode = 200): http.Server {
  const server = http.createServer((req, res) => {
    res.writeHead(statusCode, {
      "content-type": "text/plain",
      "x-upstream-port": String(port),
      "x-received-path": req.url ?? "/",
    });
    res.end(body);
  });
  server.listen(port);
  return server;
}

async function get(
  port: number,
  path = "/",
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      let body = "";
      res.on("data", (c: Buffer) => { body += c.toString(); });
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, body, headers: res.headers }),
      );
    }).on("error", reject);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ProxyServer integration", () => {
  let proxy: ProxyServer;
  let upstream1: http.Server;
  let upstream2: http.Server;

  beforeAll(async () => {
    upstream1 = startUpstream(19001, "upstream-1");
    upstream2 = startUpstream(19002, "upstream-2");

    proxy = new ProxyServer({
      port: 19000,
      balancer: "round-robin",
      headers: {
        response: { "x-proxy": "nrp" },
      },
      routes: [
        {
          match: "/api",
          rewrite: { stripPrefix: "/api" },
          upstream: [
            { host: "localhost", port: 19001 },
            { host: "localhost", port: 19002 },
          ],
        },
        {
          match: "/",
          upstream: [{ host: "localhost", port: 19001 }],
        },
      ],
    });
    await proxy.listen();
  });

  afterAll(async () => {
    await proxy.close();
    await Promise.all([
      new Promise((r) => upstream1.close(r)),
      new Promise((r) => upstream2.close(r)),
    ]);
  });

  it("proxies a basic request to the matching upstream", async () => {
    const res = await get(19000, "/");
    expect(res.status).toBe(200);
    expect(res.body).toBe("upstream-1");
  });

  it("strips prefix via rewrite rule before forwarding", async () => {
    const res = await get(19000, "/api/users");
    // Upstream receives /users not /api/users
    expect(res.headers["x-received-path"]).toBe("/users");
  });

  it("adds global response headers", async () => {
    const res = await get(19000, "/");
    expect(res.headers["x-proxy"]).toBe("nrp");
  });

  it("load-balances round-robin across upstreams", async () => {
    const ports: string[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await get(19000, "/api/test");
      ports.push(res.headers["x-upstream-port"] as string);
    }
    // Should alternate between 19001 and 19002
    expect(ports).toContain("19001");
    expect(ports).toContain("19002");
  });

  it("returns 502 for unmatched routes", async () => {
    // Temporarily test with a proxy that has no catch-all
    const strict = new ProxyServer({
      port: 19010,
      routes: [{ match: "/api", upstream: [{ host: "localhost", port: 19001 }] }],
    });
    await strict.listen();
    const res = await get(19010, "/other");
    expect(res.status).toBe(502);
    await strict.close();
  });
});
