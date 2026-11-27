import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { isolatedEnv, runBin } from "./cli.ts";
import { sandboxDir, writeIn } from "./sandbox.ts";

test("Bun reruns clean up file-level sandboxes and tolerate filtered passes", () => {
  const suite = sandboxDir("sandbox-rerun-");
  const runs = join(suite, "runs");
  const fixture = join(suite, "before-all.test.ts");
  writeIn(
    suite,
    "before-all.test.ts",
    `
import { beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { sandboxDir } from ${JSON.stringify(join(import.meta.dir, "sandbox.ts"))};

let dir: string;
beforeAll(() => {
  dir = sandboxDir("before-all-");
});

test("the sandbox is available", () => {
  expect(existsSync(dir)).toBe(true);
});
`,
  );

  const args = ["--rerun-each", "3", fixture];
  const options = {
    env: isolatedEnv(suite, { QSM_TEST_RUNS: runs }),
  };
  const result = runBin("test", args, options);
  expect(result.exit, result.stderr).toBe(0);
  expect(result.stderr).toContain("3 pass");
  expect(readdirSync(runs)).toEqual([]);

  const filtered = runBin("test", [...args, "-t", "no matching test"], options);
  expect(filtered.exit, filtered.stderr).toBe(1);
  expect(filtered.stderr).toContain('regex "no matching test" matched 0 tests');
  expect(readdirSync(runs)).toEqual([]);
});
