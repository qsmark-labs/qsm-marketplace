// What a run that was killed before its cleanup leaves behind, for the tests of each tool's backward
// cleanup.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isAlive } from "../detach.ts";
import { OWNER_VAR } from "../reap.ts";
import { isolatedEnv } from "./cli.ts";
import { atTestEnd, TEST_TMP } from "./sandbox.ts";

/** The pid of a process that has ended. */
export function deadPid(): number {
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
  const owner = `${tool}:${deadPid()}`;
  const child = Bun.spawn(["sleep", "300"], {
    env: isolatedEnv(TEST_TMP, { [OWNER_VAR]: owner }),
    stdio: ["ignore", "ignore", "ignore"],
  });
  atTestEnd(async () => {
    child.kill("SIGKILL");
    await child.exited;
  });
  const deadline = Date.now() + 5_000;
  while (!hasOwner(child.pid, owner)) {
    if (Date.now() >= deadline) {
      throw new Error(`dead-run: ${OWNER_VAR} was not visible for process ${child.pid}`);
    }
    Bun.sleepSync(1);
  }
  return child.pid;
}

function hasOwner(pid: number, owner: string): boolean {
  try {
    return readFileSync(`/proc/${pid}/environ`, "utf8")
      .split("\0")
      .includes(`${OWNER_VAR}=${owner}`);
  } catch {
    // The kernel can refuse the read while the child execs.
    return false;
  }
}

/** Whether `pid` has been reaped within a second. */
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
