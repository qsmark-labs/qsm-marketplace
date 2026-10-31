// `structure` judging several trees: a tree sentrux could not measure is not a pass, and a worse
// tree is never hidden behind it. A fake sentrux decides by a marker file in the tree it is handed.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fakeBin } from "../../../lib/fixtures/bin.ts";
import { git, repoWith } from "../../../lib/fixtures/git.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { headOf } from "../lib/test-support.ts";
import { structureJudgeAll } from "./cli-judge.ts";

const FAKE_SENTRUX = `
tree="$3"
if [ -f "$tree/hang" ]; then sleep 30; fi
edges=""
if [ -f "$tree/new-edge.ts" ]; then edges='{"from":"new-edge.ts","to":"lib/a.ts","kind":"import"}'; fi
c='{"score":0.5}'
printf '{"quality":900,"cross_module_edges":[%s],"root_causes":{"modularity":%s,"equality":%s,"redundancy":%s,"depth":%s,"acyclicity":%s}}' "$edges" "$c" "$c" "$c" "$c" "$c"
`;

/** A repository whose staged change adds `marker`, which the fake sentrux reacts to. */
function stagedWith(marker: string) {
  const { repo } = repoWith("qsm-langdev-judge-", {
    ".sentrux/rules.toml": "[constraints]\nmax_cycles = 0\n",
    "lib/a.ts": "export const a = 1;\n",
  });
  const start = headOf(repo);
  writeIn(repo, marker, "x\n");
  git(repo, "add", "-A");
  return { root: repo, start };
}

describe("structureJudgeAll", () => {
  const originalPath = process.env.PATH;
  beforeEach(() => {
    const bin = sandboxDir("qsm-langdev-judge-bin-");
    fakeBin(bin, "sentrux", FAKE_SENTRUX);
    process.env.PATH = `${bin}:${originalPath ?? ""}`;
  });
  afterEach(() => {
    process.env.PATH = originalPath;
  });

  test("a tree that hangs is not measured, not a pass", async () => {
    const report = await structureJudgeAll([stagedWith("hang")], 300);

    expect(report.result?.status).toBe("not-measured");
    expect(report.pass).toBe(false);
  });

  test("a worse tree wins over one not measured, in either order", async () => {
    const hung = stagedWith("hang");
    const worse = stagedWith("new-edge.ts");

    for (const trees of [
      [hung, worse],
      [worse, hung],
    ]) {
      const report = await structureJudgeAll(trees, 300);

      expect(report.result?.status).toBe("scored");
      expect(report.pass).toBe(false);
      expect(report.tree).toBe(worse);
    }
  });

  test("a not-measured tree wins over a passing one", async () => {
    const hung = stagedWith("hang");
    const fine = stagedWith("other.ts");

    const report = await structureJudgeAll([fine, hung], 300);

    expect(report.result?.status).toBe("not-measured");
  });
});
