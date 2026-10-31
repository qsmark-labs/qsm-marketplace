// The one way a run starts a process: its own process group, killed at the limit. A caller that
// needs a process passes its point's limit (POINTS in registry.ts, at the edit point what is left
// of its deadline), so none runs without one and none carries a limit of its own.

import { type SpawnSyncReturns, spawn as spawnChild } from "node:child_process";
import { isErrno } from "./errors.ts";

export type Spawned = Pick<
  SpawnSyncReturns<string>,
  "status" | "signal" | "error" | "stdout" | "stderr"
>;

/** Whether the process was ended at the limit rather than finishing. */
export const timedOut = (result: Spawned): boolean =>
  isErrno(result.error) && result.error.code === "ETIMEDOUT";

// The groups still running. A hook the harness ends (SIGTERM at its timeout, SIGINT) must leave no
// detached checker behind, and a detached group does not die with its parent.
const live = new Set<number>();
let armed = false;

/** Ends the group, or says why it could not: a group already gone is fine, the launcher can exit
 * while its engine keeps scanning. */
function killGroup(pid: number, command: string): Error | null {
  try {
    process.kill(-pid, "SIGKILL");
    return null;
  } catch (cause) {
    return isErrno(cause) && cause.code === "ESRCH"
      ? null
      : new Error(`could not stop ${command}'s process group`, { cause });
  }
}

function killLiveOnSignal(): void {
  if (armed) {
    return;
  }
  armed = true;
  for (const [signal, code] of [
    ["SIGTERM", 143],
    ["SIGINT", 130],
  ] as const) {
    process.on(signal, () => {
      // Every group is ended before the first failure is thrown.
      const failure = [...live]
        .map((pid) => killGroup(pid, "a running checker"))
        .find((result) => result !== null);
      if (failure !== undefined) {
        throw failure;
      }
      process.exit(code);
    });
  }
}

export function spawnAsync(
  cwd: string,
  command: string,
  args: readonly string[],
  timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Spawned> {
  return new Promise((resolvePromise, rejectPromise) => {
    // `env` named: Bun resolves the binary against the PATH the process started with unless it is
    // handed one, and a test puts a fake first.
    const child = spawnChild(command, args, { cwd, detached: true, env });
    // A tool that reads stdin sees the end of it, as it did under spawnSync.
    child.stdin.end();
    let stdout = "";
    let stderr = "";
    let error: NodeJS.ErrnoException | undefined;
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      error = Object.assign(new Error(`${command} timed out`), { code: "ETIMEDOUT" });
      // This group belongs to this run.
      if (child.pid !== undefined) {
        const failure = killGroup(child.pid, command);
        if (failure !== null) {
          rejectPromise(failure);
        }
      }
    }, timeoutMs);
    if (child.pid !== undefined) {
      live.add(child.pid);
      killLiveOnSignal();
    }
    child.on("error", (err: NodeJS.ErrnoException) => {
      error = err;
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      if (child.pid !== undefined) {
        live.delete(child.pid);
      }
      resolvePromise({ status, signal, stdout, stderr, ...(error === undefined ? {} : { error }) });
    });
  });
}
