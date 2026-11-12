// A scratch directory goes exactly when its run is dead, not when its mtime is old.

import { expect, test } from "bun:test";
import { existsSync, mkdirSync, rmdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";
import { withScratchDir } from "./tree.ts";

test("a scratch directory of a dead run is removed at once and a live run's is kept", async () => {
  // The sandbox's parent is the run's TMPDIR, the one withScratchDir uses.
  const base = dirname(sandboxDir("qsm-langdev-tree-test-"));
  const dead = join(base, "qsm-langdev-tree.2147483646.abcdef");
  const live = join(base, `qsm-langdev-tree.${process.ppid}.abcdef`);
  mkdirSync(dead);
  mkdirSync(live);

  await withScratchDir("qsm-langdev-tree", () => {});

  expect(existsSync(dead)).toBe(false);
  expect(existsSync(live)).toBe(true);
  rmdirSync(live);
});
