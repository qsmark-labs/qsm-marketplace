import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { bareRuntimePath, fakeBin } from "../../../lib/fixtures/bin.ts";
import { dataOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";

test("the installer builds qsm-tasks with gh present and br absent", () => {
  const home = sandboxDir("qsm-tasks-install-");
  const bin = join(home, "bin");
  fakeBin(home, "gh", "exit 0");
  const env = isolatedEnv(home, {
    PATH: [home, bareRuntimePath()].join(":"),
    QSM_BIN_DIR: bin,
  });

  const result = runBin(join(import.meta.dir, "install.ts"), ["--json"], { env });
  expect(dataOf(result.stdout)).toMatchObject({ status: "installed" });
  expect(result.exit).toBe(0);
  expect(existsSync(join(bin, "qsm-tasks"))).toBe(true);
  expect(result.stdout).not.toContain("upstream br");
}, 30_000);
