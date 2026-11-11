// The board resolution as a verb meets it, with a recording fake gh: the cases the live repository
// cannot show, because it has exactly one linked board. Answers are recorded from the real gh.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bareRuntimePath, fakeBin } from "../../../lib/fixtures/bin.ts";
import { envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";

const CLI = join(import.meta.dir, "cli.ts");
const BOARD = { id: "PVT_kwDOFMPqAc4Bo0vN", number: 1, owner: { login: "qsmark-labs" } };

function linked(nodes: readonly unknown[]): string {
  const repo = { id: "R_kgDOVGCdTA", nameWithOwner: "qsmark-labs/qsm-marketplace" };
  return JSON.stringify({ data: { repository: { ...repo, projectsV2: { nodes } } } });
}

/** Runs `qsm-tasks ready --json` with a gh that answers `answer` and records each call. */
function ready(answer: string): { exit: number; data: unknown; message: string; calls: string[] } {
  const dir = sandboxDir("qsm-tasks-");
  // builtins only: the PATH holds the fake and the runtime, no cat
  fakeBin(dir, "gh", `printf '%s\\n' "$*" >> "${dir}/calls"; printf '%s' '${answer}'`);
  const env = isolatedEnv(dir, { PATH: `${dir}:${bareRuntimePath()}` });
  const r = runBin(CLI, ["ready", "--json"], { env });
  const out = envelopeOf(r.stdout);
  const calls = readFileSync(join(dir, "calls"), "utf8").trim().split("\n");
  return { exit: r.exit, data: out.data, message: out.message, calls };
}

describe("qsm-tasks resolves the board", () => {
  it("is missing no-board when the repository has no linked board, after one gh call", () => {
    const r = ready(linked([]));
    expect(r.exit).toBe(4);
    expect(r.data).toMatchObject({ reason: "no-board" });
    expect(r.calls).toHaveLength(1);
  });

  it("is a usage naming --project when several boards are linked", () => {
    const r = ready(linked([BOARD, { ...BOARD, id: "PVT_other", number: 2 }]));
    expect(r.exit).toBe(2);
    expect(r.message).toContain("qsmark-labs/1, qsmark-labs/2): pass --project");
  });
});
