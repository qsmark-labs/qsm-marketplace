// qsm-tasks as a shell meets it, through the real entry. Where a live repository cannot show a
// case, a recording fake gh answers what the real gh answered.
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bareRuntimePath, fakeBin } from "../../../lib/fixtures/bin.ts";
import { envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";

const CLI = join(import.meta.dir, "cli.ts");

describe("qsm-tasks without gh", () => {
  it("exits missing no-gh on a verb on the board", () => {
    const env = isolatedEnv(sandboxDir("qsm-tasks-"), { PATH: bareRuntimePath() });
    const r = runBin(CLI, ["ready", "--json"], { env });
    expect(r.exit).toBe(4);
    expect(envelopeOf(r.stdout).data).toMatchObject({ reason: "no-gh" });
  });
});

const BOARD = { id: "PVT_kwDOFMPqAc4Bo0vN", number: 1, owner: { login: "qsmark-labs" } };

function linked(nodes: readonly unknown[], hasNextPage = false): string {
  const repo = { id: "R_kgDOVGCdTA", nameWithOwner: "qsmark-labs/qsm-marketplace" };
  const projectsV2 = { pageInfo: { hasNextPage }, nodes };
  return JSON.stringify({ data: { repository: { ...repo, projectsV2 } } });
}

interface FakeGh {
  readonly stdout: string;
  readonly stderr?: string;
  readonly exit?: number;
}

/** Runs `qsm-tasks <argv> --json` with a gh that answers `gh` and records each call. */
function run(gh: FakeGh, argv: readonly string[] = ["ready"]) {
  const dir = sandboxDir("qsm-tasks-");
  const calls = join(dir, "calls");
  // builtins only: the PATH holds the fake and the runtime, no cat
  const body = `printf '%s\\n' "$*" >> "${calls}"; printf '%s' '${gh.stdout}'; printf '%s' '${gh.stderr ?? ""}' >&2; exit ${gh.exit ?? 0}`;
  fakeBin(dir, "gh", body);
  const env = isolatedEnv(dir, { PATH: `${dir}:${bareRuntimePath()}` });
  const r = runBin(CLI, [...argv, "--json"], { env });
  const out = envelopeOf(r.stdout);
  const recorded = existsSync(calls) ? readFileSync(calls, "utf8").trim().split("\n") : [];
  return { exit: r.exit, data: out.data, message: out.message, calls: recorded };
}

describe("qsm-tasks resolves the board", () => {
  it("is missing no-repo when gh finds no repository, from gh's recorded words", () => {
    const stderr = `error parsing "owner" value: failed to run git: fatal: not a git repository (or any parent up to mount point /)`;
    const r = run({ stdout: "", stderr, exit: 1 });
    expect(r.exit).toBe(4);
    expect(r.data).toMatchObject({ reason: "no-repo" });
  });

  it("is missing no-board when the repository has no open linked board, after one gh call", () => {
    const r = run({ stdout: linked([]) });
    expect(r.exit).toBe(4);
    expect(r.data).toMatchObject({ reason: "no-board" });
    expect(r.calls).toHaveLength(1);
  });

  it("is a usage naming the boards when several are linked", () => {
    const r = run({ stdout: linked([BOARD, { ...BOARD, id: "PVT_other", number: 2 }]) });
    expect(r.exit).toBe(2);
    expect(r.message).toContain("(qsmark-labs/1, qsmark-labs/2)");
  });

  it("is a usage when GitHub holds more linked boards than one page", () => {
    const r = run({ stdout: linked([BOARD], true) });
    expect(r.exit).toBe(2);
    expect(r.message).toContain("(qsmark-labs/1 and more)");
  });

  it("runs no gh call on an unknown flag", () => {
    const r = run({ stdout: linked([BOARD]) }, ["ready", "--bogus"]);
    expect(r.exit).toBe(2);
    expect(r.calls).toEqual([]);
  });
});
