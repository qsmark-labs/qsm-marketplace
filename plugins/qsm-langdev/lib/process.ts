// The one way a run starts a process: its own process group, killed at the limit. A caller that
// needs a process passes its point's limit (POINTS in registry.ts, at the edit point what is left
// of its deadline), so none runs without one and none carries a limit of its own.

import { type SpawnSyncReturns, spawn as spawnChild } from "node:child_process";
import { ownerEnv, reapOrphaned, reapOwned } from "../../../lib/reap.ts";
import { isErrno } from "./errors.ts";

const TOOL = "qsm-langdev";

// No checker leaves a build server running. A dotnet build's MSBuild nodes and VBCSCompiler outlive
// it and carry the owner mark, and another build (a second session's gate, the person's own) then
// reuses them, so cleaning them up would kill them under that build.
const NO_BUILD_SERVERS = {
  MSBUILDDISABLENODEREUSE: "1",
  DOTNET_CLI_USE_MSBUILD_SERVER: "0",
  UseSharedCompilation: "false",
};

/** Kills what a dead run left of its checkers, naming each. */
export function reapOrphans(): void {
  reapOrphaned(TOOL, "left by a run that ended before its cleanup");
}

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

/** Once per process, before the first checker starts: ends what a dead run left, and arms the
 * cleanup of whatever this run's checkers leave (a descendant that left the group with setsid). It
 * is not done after each checker: checkers run in parallel and that would kill a sibling's. */
function armCleanup(): void {
  if (armed) {
    return;
  }
  armed = true;
  reapOrphans();
  process.on("exit", () => {
    reapOwned(TOOL, "left running when the run ended");
  });
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
    armCleanup();
    const child = spawnChild(command, args, {
      cwd,
      detached: true,
      env: { ...env, ...NO_BUILD_SERVERS, ...ownerEnv(TOOL) },
    });
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
    }
    child.on("error", (err: NodeJS.ErrnoException) => {
      error = err;
    });
    // The kill waits for `exit`, not `close`: `close` waits for every holder of the output pipes,
    // so a background child that kept them would delay it until the limit and make a checker that
    // ended cleanly look timed out.
    child.on("exit", () => {
      clearTimeout(timer);
      if (child.pid !== undefined) {
        live.delete(child.pid);
        // The checker ended; what it started in the background must not outlive it.
        const failure = killGroup(child.pid, command);
        if (failure !== null) {
          rejectPromise(failure);
        }
      }
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolvePromise({ status, signal, stdout, stderr, ...(error === undefined ? {} : { error }) });
    });
  });
}
