// A hook the harness ends leaves no detached checker behind: the real parent is a bun process that
// starts a run with a sleeping checker, and is sent SIGTERM mid-run.

import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { processWith } from "./test-support.ts";

const PROCESS = resolve(import.meta.dir, "process.ts");

const marked = (marker: string): boolean => processWith(`sleep ${marker}`);

test("SIGTERM to the parent ends the checker's process group before the parent exits", async () => {
  const dir = sandboxDir("qsm-langdev-process-");
  // The checker sleeps for a number nothing else does, so its command line names it.
  const marker = `${process.pid}${Date.now()}`;
  writeIn(
    dir,
    "run.ts",
    `import { spawnAsync } from ${JSON.stringify(PROCESS)};\n` +
      `await spawnAsync(${JSON.stringify(dir)}, "sh", ["-c", "sleep ${marker}.5 & wait"], 60_000);\n`,
  );
  const parent = spawn(process.execPath, [join(dir, "run.ts")], { stdio: "ignore" });
  const exited = new Promise<number | null>((done) => {
    parent.on("close", (code) => {
      done(code);
    });
  });
  for (let waited = 0; !marked(marker) && waited < 5_000; waited += 50) {
    await Bun.sleep(50);
  }
  expect(marked(marker)).toBe(true);

  parent.kill("SIGTERM");

  expect(await exited).toBe(143);
  expect(marked(marker)).toBe(false);
});
