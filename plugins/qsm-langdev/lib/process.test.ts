// A hook the harness ends leaves no detached checker behind: the real parent is a bun process that
// starts a run with a sleeping checker, and is sent SIGTERM mid-run.

import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { reapOrphans, spawnAsync } from "./process.ts";
import { processWith } from "./test-support.ts";

const PROCESS = resolve(import.meta.dir, "process.ts");

const marked = (marker: string): boolean => processWith(`sleep ${marker}`);

/** A bun process that runs a checker leaving a sleeping child, once the child is running; the
 * checker sleeps for a number nothing else does, so its command line names it. */
async function runWithCheckerRunning(): Promise<{
  parent: ReturnType<typeof spawn>;
  exited: Promise<number | null>;
  marker: string;
}> {
  const dir = sandboxDir("qsm-langdev-process-");
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
  return { parent, exited, marker };
}

test("SIGTERM to the parent ends the checker's process group before the parent exits", async () => {
  const { parent, exited, marker } = await runWithCheckerRunning();

  parent.kill("SIGTERM");

  expect(await exited).toBe(143);
  expect(marked(marker)).toBe(false);
});

test("a checker that exits leaves none of its background children running", async () => {
  const dir = sandboxDir("qsm-langdev-process-");
  const marker = `${process.pid}${Date.now()}`;

  const result = await spawnAsync(dir, "sh", ["-c", `sleep ${marker}.5 >/dev/null 2>&1 &`], 60_000);

  expect(result.status).toBe(0);
  expect(marked(marker)).toBe(false);
});

test("a checker runs with the build servers off", async () => {
  const dir = sandboxDir("qsm-langdev-process-");

  const result = await spawnAsync(
    dir,
    "sh",
    ["-c", 'echo "$MSBUILDDISABLENODEREUSE $DOTNET_CLI_USE_MSBUILD_SERVER $UseSharedCompilation"'],
    60_000,
    { PATH: process.env["PATH"] ?? "" },
  );

  expect(result.stdout.trim()).toBe("1 0 false");
});

test("a checker's descendant in its own session is gone when the run ends", () => {
  const dir = sandboxDir("qsm-langdev-process-");
  const marker = `${process.pid}${Date.now()}`;
  writeIn(
    dir,
    "run.ts",
    `import { spawnAsync } from ${JSON.stringify(PROCESS)};\n` +
      `await spawnAsync(${JSON.stringify(dir)}, "sh", ["-c", "setsid sleep ${marker}.5 >/dev/null 2>&1 &"], 60_000);\n`,
  );

  const run = Bun.spawnSync([process.execPath, join(dir, "run.ts")], { stderr: "pipe" });

  expect(run.exitCode).toBe(0);
  expect(marked(marker)).toBe(false);
});

test("a gate run first ends the checkers a killed earlier run left", async () => {
  const { parent, exited, marker } = await runWithCheckerRunning();
  parent.kill("SIGKILL");
  await exited;
  expect(marked(marker)).toBe(true);

  reapOrphans();

  expect(marked(marker)).toBe(false);
});
