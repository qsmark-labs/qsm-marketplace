// The loopback server kit for real: a server on a free port answers its own Host and pages only,
// and a second listen on the same port names it.
import { expect, test } from "bun:test";
import { fromLoopbackHost, fromOwnPage, listenLoopback } from "./loopback.ts";
import { QsmError } from "./qsm-error.ts";

test("a loopback server refuses a foreign Host and a write from another page", async () => {
  const at = { port: 0 };
  const server = listenLoopback(0, (req) =>
    fromLoopbackHost(req, at.port)
      ? req.method === "POST" && !fromOwnPage(req, at.port)
        ? new Response("origin", { status: 403 })
        : new Response("ok")
      : new Response("host", { status: 403 }),
  );
  at.port = server.port ?? 0;
  const url = `http://127.0.0.1:${at.port}/`;
  const post = (headers: Record<string, string>) => fetch(url, { method: "POST", headers });
  try {
    expect((await fetch(url)).status).toBe(200);
    expect((await fetch(url, { headers: { host: "evil.example" } })).status).toBe(403);
    const own = { "content-type": "application/json", origin: url.slice(0, -1) };
    expect((await post(own)).status).toBe(200);
    expect((await post({ ...own, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ ...own, "content-type": "text/plain" })).status).toBe(403);
    expect(() => listenLoopback(at.port, () => new Response("x"))).toThrow(QsmError);
  } finally {
    await server.stop(true);
  }
});
