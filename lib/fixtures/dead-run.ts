// What a run that was killed before its cleanup leaves behind, for the tests of each tool's backward
// cleanup.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { isAlive } from "../detach.ts";
import { OWNER_VAR } from "../reap.ts";
import { isolatedEnv } from "./cli.ts";
import { atTestEnd, TEST_TMP } from "./sandbox.ts";

/** The pid of a process that has ended. */
function deadPid(): number {
  const pid = spawnSync("true").pid;
  if (pid === undefined) {
    throw new Error("dead-run: `true` did not start");
  }
  return pid;
}

/** A directory `<tool>.<dead pid>.left` under `base`, as a run killed mid-call leaves it. */
export function leftDir(tool: string, base: string = TEST_TMP): string {
  const dir = join(base, `${tool}.${deadPid()}.left`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A process marked as started by a dead run of `tool`; stopped after the test if the code under
 * test did not end it. */
export function leftProcess(tool: string): number {
  // Started by a shell that exits, so the sleep is an orphan under init, as after a crash, and a
  // kill leaves no zombie of this process for a synchronous test to see as alive.
  const started = spawnSync("sh", ["-c", "sleep 300 >/dev/null 2>&1 & echo $!"], {
    encoding: "utf8",
    env: isolatedEnv(TEST_TMP, { [OWNER_VAR]: `${tool}:${deadPid()}` }),
  });
  const pid = Number(started.stdout.trim());
  if (!Number.isInteger(pid)) {
    throw new TypeError("dead-run: sleep did not start");
  }
  atTestEnd(() => {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ended already: the code under test did its job
    }
  });
  return pid;
}

/** Whether `pid` is gone within a second: a killed orphan stays a zombie, which `kill(pid, 0)`
 * calls alive, until init has reaped it. */
export async function ended(pid: number): Promise<boolean> {
  for (let waited = 0; waited < 1000 && isAlive(pid); waited += 10) {
    await Bun.sleep(10);
  }
  return !isAlive(pid);
}

/** A dir and a process that a dead run of `tool` left; `gone()` says both are cleared. */
export function plantLeftovers(
  tool: string,
  base: string = TEST_TMP,
): { gone: () => Promise<boolean> } {
  const dir = leftDir(tool, base);
  const pid = leftProcess(tool);
  return { gone: async () => (await ended(pid)) && !existsSync(dir) };
}
