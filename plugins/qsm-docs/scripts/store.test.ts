// The store through the real entry: a repository with a second worktree, snapshots created, read
// back byte for byte, listed and diffed, and the sha256 of every stored file unchanged after each
// verb.
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { dataOf, envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { commit, git } from "../../../lib/fixtures/git.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { isRecord } from "../../../lib/outcome.ts";

const CLI = resolve(import.meta.dir, "cli.ts");

interface Store {
  readonly repo: string;
  readonly worktree: string;
  readonly env: Record<string, string>;
  readonly run: (args: string[], cwd?: string) => ReturnType<typeof runBin>;
  /** the id a create printed */
  readonly create: (args: string[], cwd?: string) => string;
}

/** `demo`, a repository on main with a worktree on `spec/qsm-docs-write`, and a sandbox store. */
function store(): Store {
  const root = sandboxDir("qsm-docs-store-");
  const repo = join(root, "demo");
  git(root, "init", "-q", "-b", "main", repo);
  writeIn(repo, "README.md", "demo\n");
  commit(repo, "one");
  const worktree = join(root, "wt");
  git(repo, "worktree", "add", "-q", "-b", "spec/qsm-docs-write", worktree);
  const env = isolatedEnv(sandboxDir("qsm-docs-home-"));
  const run = (args: string[], cwd = repo) => runBin(CLI, args, { env, cwd });
  const create = (args: string[], cwd = repo) => {
    const r = run(["create", ...args, "--json"], cwd);
    const data = dataOf(r.stdout);
    if (r.exit !== 0 || !isRecord(data) || typeof data.id !== "string") {
      throw new Error(`create ${args.join(" ")}: ${r.stdout}${r.stderr}`);
    }
    return data.id;
  };
  return { repo, worktree, env, run, create };
}

const sha = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

/** Every snapshot file of the project with the sha256 it holds now. */
function hashes(s: Store, project: string): Record<string, string> {
  const dir = join(s.env.XDG_DATA_HOME ?? "", "qsm-docs", project);
  const ledger = readFileSync(join(dir, "ledger.jsonl"), "utf8").trim().split("\n");
  const out: Record<string, string> = {};
  for (const line of ledger) {
    const parsed: unknown = JSON.parse(line);
    if (isRecord(parsed) && parsed.op === "create") {
      out[String(parsed.id)] = sha(join(dir, `${String(parsed.id)}.${String(parsed.ext)}`));
    }
  }
  return out;
}

function ids(stdout: string): string[] {
  const data = dataOf(stdout);
  return Array.isArray(data) ? data.map((e: unknown) => (isRecord(e) ? String(e.id) : "")) : [];
}

describe("the store", () => {
  it("creates a snapshot, reads it back byte for byte, and keeps every hash through every verb", () => {
    const s = store();
    const text = '{\n  "title": "a",\n  "tags": [1, 2]\n}';
    writeIn(s.repo, "state.json", text);
    const first = s.create(["json", "state.json"]);
    expect(first).toMatch(/^demo-main-\d{8}T\d{9}Z$/);

    const got = s.run(["get", first]);
    expect(got.exit).toBe(0);
    expect(got.stdout).toBe(text);
    const before = hashes(s, "demo");
    expect(Object.keys(before)).toEqual([first]);

    writeIn(s.repo, "next.json", '{"title": "b"}');
    const second = s.create(["json", "next.json", "--parent", first]);
    const after = s.run(["diff", second]);
    expect(after.stdout).toBe("changed title\nremoved tags\n");
    s.run(["list", "demo"]);
    s.run(["get", second]);
    expect(hashes(s, "demo")[first]).toBe(before[first] ?? "");
    expect(hashes(s, "demo")[first]).toBe(createHash("sha256").update(text).digest("hex"));
  });

  it("names the worktree's branch under the main checkout's project", () => {
    const s = store();
    writeIn(s.worktree, "w.json", "{}");
    expect(s.create(["json", "w.json"], s.worktree)).toMatch(
      /^demo-spec_qsm-docs-write-\d{8}T\d{9}Z$/,
    );
  });

  it("lists newest first, by branch and kind", () => {
    const s = store();
    writeIn(s.repo, "a.json", "{}");
    writeIn(s.worktree, "a.json", "{}");
    const made = [1, 2, 3].map(() => s.create(["json", "a.json"]));
    s.create(["json", "a.json"], s.worktree);
    const main = s.run(["list", "demo", "--branch", "main", "--json"]);
    expect(ids(main.stdout)).toEqual(made.toReversed());
    expect(ids(s.run(["list", "demo", "--json"]).stdout)).toHaveLength(4);
    expect(ids(s.run(["list", "demo", "--kind", "bpmn", "--json"]).stdout)).toEqual([]);
  });

  it("refuses a file that is not JSON and stores nothing", () => {
    const s = store();
    writeIn(s.repo, "broken.json", "{ nope");
    const r = s.run(["create", "json", "broken.json", "--json"]);
    expect(envelopeOf(r.stdout).code).toBe("failed");
    expect(envelopeOf(r.stdout).message).toContain("json: the file is not JSON");
    expect(s.run(["list", "demo"]).stdout).toBe("demo: no snapshots\n");
  });

  it("refuses a parent that names no snapshot", () => {
    const s = store();
    writeIn(s.repo, "a.json", "{}");
    const r = s.run(["create", "json", "a.json", "--parent", "demo-main-x", "--json"]);
    expect(envelopeOf(r.stdout).code).toBe("missing");
  });

  it("fails get naming the id and both hashes when the file changed behind its back", () => {
    const s = store();
    writeIn(s.repo, "a.json", "{}");
    const id = s.create(["json", "a.json"]);
    const file = join(s.env.XDG_DATA_HOME ?? "", "qsm-docs", "demo", `${id}.json`);
    chmodSync(file, 0o644);
    writeFileSync(file, '{"edited": true}');
    const r = s.run(["get", id]);
    expect(r.exit).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain(id);
    expect(r.stderr).toContain(sha(file));
    expect(r.stderr).toContain(createHash("sha256").update("{}").digest("hex"));
  });

  it("names the project and branch with flags outside git, and refuses without them", () => {
    const s = store();
    const outside = sandboxDir("qsm-docs-outside-");
    writeIn(outside, "a.json", "{}");
    expect(s.run(["create", "json", "a.json", "--json"], outside).exit).toBe(2);
    expect(
      s.create(["json", "a.json", "--project", "demo", "--branch", "feat/x"], outside),
    ).toMatch(/^demo-feat_x-/);
  });

  it("refuses a detached HEAD without --branch", () => {
    const s = store();
    git(s.repo, "checkout", "-q", "--detach");
    writeIn(s.repo, "a.json", "{}");
    expect(envelopeOf(s.run(["create", "json", "a.json", "--json"]).stdout).code).toBe("blocked");
  });

  it("deletes a snapshot, records it, and get then fails missing", () => {
    const s = store();
    writeIn(s.repo, "a.json", "{}");
    const kept = s.create(["json", "a.json"]);
    const gone = s.create(["json", "a.json"]);
    expect(s.run(["delete", gone]).exit).toBe(0);
    expect(ids(s.run(["list", "demo", "--json"]).stdout)).toEqual([kept]);
    expect(envelopeOf(s.run(["get", gone, "--json"]).stdout).code).toBe("missing");
    const ledger = readFileSync(
      join(s.env.XDG_DATA_HOME ?? "", "qsm-docs", "demo", "ledger.jsonl"),
      "utf8",
    );
    expect(ledger).toContain(`"op":"delete","id":"${gone}"`);
    expect(s.run(["get", kept]).stdout).toBe("{}");
  });

  it("refuses a diff of a snapshot without a parent and no second id", () => {
    const s = store();
    writeIn(s.repo, "a.json", "{}");
    const id = s.create(["json", "a.json"]);
    expect(s.run(["diff", id]).exit).toBe(2);
  });
});
