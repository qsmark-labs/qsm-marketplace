// `qsm-docs serve` through its real surface: the binary serves a sandbox store from a checkout of
// `demo` on main, the pages and the API are fetched over HTTP, and a save becomes a proposal.
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { dataOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { fakeBin } from "../../../lib/fixtures/bin.ts";
import { commit, git } from "../../../lib/fixtures/git.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { startServer } from "../../../lib/fixtures/server.ts";
import { isRecord } from "../../../lib/outcome.ts";

const CLI = resolve(import.meta.dir, "cli.ts");

/** A checkout of `demo` on main, a sandbox store, and the binary run against both. */
function checkout() {
  const root = sandboxDir("qsm-docs-serve-");
  const repo = join(root, "demo");
  git(root, "init", "-q", "-b", "main", repo);
  writeIn(repo, "README.md", "demo\n");
  commit(repo, "one");
  const env = isolatedEnv(join(root, "home"));
  const run = (args: string[]) => runBin(CLI, args, { env, cwd: repo });
  const create = (rel: string, text: string): string => {
    writeIn(repo, rel, text);
    const data = dataOf(run(["create", "json", rel, "--json"]).stdout);
    if (!isRecord(data) || typeof data.id !== "string") {
      throw new Error(`create ${rel} failed`);
    }
    return data.id;
  };
  const file = (id: string) => join(root, "home", "data", "qsm-docs", "demo", `${id}.json`);
  return { root, repo, env, run, create, file };
}

/** The binary serving the checkout on a free port. */
const start = (repo: string, env: Record<string, string>) =>
  startServer([process.execPath, CLI, "serve", "--port", "0"], { cwd: repo, env });

const sha = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

/** A save as the json page posts it. */
function post(url: string, body: unknown, origin = url.slice(0, -1)): Promise<Response> {
  return fetch(`${url}api/snapshots`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

function openIds(run: (args: string[]) => { stdout: string }): string[] {
  const data = dataOf(run(["list", "demo", "--open", "--json"]).stdout);
  return Array.isArray(data) ? data.map((e: unknown) => (isRecord(e) ? String(e.id) : "")) : [];
}

describe("serve", () => {
  it("shows the newest json snapshot of the checkout's branch at /json, with its id and time", async () => {
    const c = checkout();
    c.create("a.json", '{"n": 1}');
    const newest = c.create("b.json", '{"n": 2}');
    await using server = await start(c.repo, c.env);
    const { url } = server;
    const res = await fetch(`${url}json`);
    const page = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(page).toContain(`<dd id="snapshot">${newest}</dd>`);
    expect(page).toContain('<dd id="project">demo</dd>');
    expect(page).toContain('<dd id="branch">main</dd>');
    expect(page).toContain(`src="/kinds/json/index.html#id=${newest}"`);
    const frame = await fetch(`${url}kinds/json/index.html`);
    expect(frame.status).toBe(200);
    expect(frame.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("answers the page API: the stored bytes, the converter's JSON, and a save as a proposal", async () => {
    const c = checkout();
    const text = '{\n  "title": "a",\n  "tags": [1]\n}';
    const open = c.create("a.json", text);
    const before = sha(c.file(open));
    await using server = await start(c.repo, c.env);
    const { url } = server;
    const bytes = await fetch(`${url}api/snapshots/${open}`);
    expect(bytes.headers.get("content-type")).toBe("application/json");
    expect(await bytes.text()).toBe(text);
    expect(await (await fetch(`${url}api/snapshots/${open}/json`)).json()).toEqual({
      title: "a",
      tags: [1],
    });

    const saved = await post(url, { kind: "json", parent: open, content: '{"title": "b"}' });
    expect(saved.status).toBe(201);
    const body: unknown = await saved.json();
    const proposal = isRecord(body) ? String(body.id) : "";
    expect(proposal).toMatch(/^demo-main-/);
    expect(openIds(c.run)).toEqual([proposal]);
    expect(c.run(["diff", proposal]).stdout).toBe("changed title\nremoved tags\n");
    expect(sha(c.file(open))).toBe(before);

    // the agent applies it: the proposal leaves the open list
    writeIn(c.repo, "applied.json", '{"title": "b"}');
    c.run(["create", "json", "applied.json", "--parent", proposal]);
    expect(openIds(c.run)).toEqual([]);
  });

  it("refuses a post from another origin, a post without JSON, and a foreign Host", async () => {
    const c = checkout();
    const open = c.create("a.json", "{}");
    await using server = await start(c.repo, c.env);
    const { url } = server;
    const body = { kind: "json", parent: open, content: "{}" };
    expect((await post(url, body, "https://evil.example")).status).toBe(403);
    const plain = await fetch(`${url}api/snapshots`, {
      method: "POST",
      headers: { "content-type": "text/plain", origin: url.slice(0, -1) },
      body: JSON.stringify(body),
    });
    expect(plain.status).toBe(403);
    const rebound = await fetch(`${url}json`, { headers: { host: "evil.example" } });
    expect(rebound.status).toBe(403);
    expect(c.run(["list", "demo", "--json"]).stdout).toContain(open);
    expect(openIds(c.run)).toEqual([]);
  });

  it("answers a save that does not parse with the store's error and stores nothing", async () => {
    const c = checkout();
    const open = c.create("a.json", "{}");
    await using server = await start(c.repo, c.env);
    const { url } = server;
    const res = await post(url, { kind: "json", parent: open, content: "{ nope" });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "failed" });
    const missing = await post(url, { kind: "json", parent: "demo-main-x", content: "{}" });
    expect(missing.status).toBe(404);
    expect(openIds(c.run)).toEqual([]);
  });

  it("serves an added kind's page from its own copy after the installing tree is gone", async () => {
    const c = checkout();
    const plugin = join(c.root, "plugin");
    const ok = fakeBin(c.root, "fake-ok", "echo '{}'");
    writeIn(plugin, "pages/index.html", "<!doctype html><title>fake page</title>");
    writeIn(
      plugin,
      "fake.json",
      JSON.stringify({
        name: "fake",
        plugin: "qsm-fake",
        mediaType: "application/x-fake",
        ext: "fake",
        pages: "pages",
        convert: [ok, "{file}"],
        diff: [ok, "{a}", "{b}"],
      }),
    );
    expect(c.run(["kind", "add", join(plugin, "fake.json")]).exit).toBe(0);
    rmSync(plugin, { recursive: true });
    writeIn(c.repo, "d.fake", "x");
    c.run(["create", "fake", "d.fake"]);
    await using server = await start(c.repo, c.env);
    const { url } = server;
    expect(await (await fetch(`${url}kinds/fake/index.html`)).text()).toContain("fake page");
    expect((await fetch(`${url}fake`)).status).toBe(200);
    expect((await fetch(`${url}kinds/fake/..%2f..%2fmanifest.json`)).status).toBe(404);
    c.run(["kind", "remove", "fake"]);
    const gone = await fetch(`${url}fake`);
    expect(gone.status).toBe(404);
    expect(await gone.text()).toContain("the kind fake is not installed");
  });
});
