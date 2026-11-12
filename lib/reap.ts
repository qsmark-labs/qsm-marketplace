// The processes and temp directories a tool made and must remove. A tool marks each process it
// starts with QSM_OWNER=<tool>:<its own pid>, added after the marks it carries itself (`ownerEnv`),
// in the child's environment, which every descendant inherits, a daemon in its own session and an
// orphan under PID 1 included. One scan of /proc then finds them when a call ends (forward
// cleanup, `owned`) and, after a run that crashed before its cleanup, when the next run of the tool
// starts (backward cleanup, `orphaned`). A temp directory carries its run's pid in its name for
// the same two sweeps (`runTempDir`, `sweepTempDirs`).

import {
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAlive } from "./detach.ts";

export const OWNER_VAR = "QSM_OWNER";
const MARK = `${OWNER_VAR}=`;
const LEFT_BY_CRASH = "left by a run that ended before its cleanup";

export type Proc = { readonly pid: number; readonly ppid: number; readonly cmd: string };
type Stat = { readonly pid: number; readonly ppid: number };

/** The text of `/proc/<pid>/<file>`, or null when the process ended or is not ours to read. */
function procFile(pid: number, file: string): Buffer | null {
  try {
    return readFileSync(`/proc/${pid}/${file}`);
  } catch {
    return null;
  }
}

/** The pid of every process now listed in /proc. */
function pids(): number[] {
  return readdirSync("/proc")
    .map(Number)
    .filter((pid) => Number.isInteger(pid));
}

/** The process with its parent, from its stat file, or null when it ended or is a zombie. */
function statOf(pid: number): Stat | null {
  const stat = procFile(pid, "stat")?.toString();
  if (stat === undefined) {
    return null;
  }
  // The command name sits in parentheses and may hold spaces; state and ppid follow it.
  const [state, ppid] = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return state === "Z" ? null : { pid, ppid: Number(ppid) };
}

/** Every live process with its parent. */
function scan(): Stat[] {
  return pids().flatMap((pid) => statOf(pid) ?? []);
}

/** The processes with their command lines, read only for these; one that ended is left out. */
function withCmd(stats: readonly Stat[]): Proc[] {
  return stats.flatMap((s) => {
    const cmd = procFile(s.pid, "cmdline");
    return cmd === null ? [] : [{ ...s, cmd: cmd.toString().replaceAll("\0", " ").trim() }];
  });
}

/** Every live process on the machine. */
export function processes(): Proc[] {
  return withCmd(scan());
}

/** The environment entries that mark a child of this process as `tool`'s. The mark is a chain:
 * this run's entry is added after the marks this process carries, so a test run still finds what
 * the code under it started, and each tool still finds its own. */
function ownerEnv(tool: string): Record<string, string> {
  const outer = process.env[OWNER_VAR];
  const entry = `${tool}:${process.pid}`;
  return { [OWNER_VAR]: outer === undefined || outer === "" ? entry : `${outer} ${entry}` };
}

/** Each live process that carries `tool`'s mark, with the pid of the innermost run of `tool` that
 * marked it, because that run is its owner; this process is left out. Most processes carry no
 * mark, so the environment is searched as bytes before any of it is decoded, and only a marked
 * process has its stat read. */
function marked(tool: string): { stat: Stat; runPid: number }[] {
  return pids().flatMap((pid) => {
    const env = pid === process.pid ? null : procFile(pid, "environ");
    const stat = env?.includes(MARK) === true ? statOf(pid) : null;
    if (env === null || stat === null) {
      return [];
    }
    const entry = env
      .toString()
      .split("\0")
      .find((e) => e.startsWith(MARK))
      ?.slice(MARK.length)
      .split(" ")
      .findLast((e) => e.startsWith(`${tool}:`));
    const runPid = Number(entry?.slice(tool.length + 1));
    return Number.isInteger(runPid) ? [{ stat, runPid }] : [];
  });
}

/** The live processes this run of `tool` started. */
function owned(tool: string): Proc[] {
  return withCmd(
    marked(tool)
      .filter((m) => m.runPid === process.pid)
      .map((m) => m.stat),
  );
}

/** The live processes runs of `tool` started that have since ended: what a crash left. */
function orphaned(tool: string): Proc[] {
  return withCmd(
    marked(tool)
      .filter((m) => !isAlive(m.runPid))
      .map((m) => m.stat),
  );
}

/** Kills each process with SIGKILL, never this one; one that already ended is skipped. */
function reap(procs: readonly Proc[]): void {
  for (const { pid } of procs) {
    if (pid === process.pid) {
      continue;
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      continue;
    }
  }
}

/** `reap` that names each process on stderr as `<tool>: killed <pid> <cmd>, <why>`. */
function reapNamed(tool: string, procs: readonly Proc[], why: string): void {
  reap(procs);
  for (const p of procs) {
    console.error(`${tool}: killed ${p.pid} ${p.cmd}, ${why}`);
  }
}

/** Runs `command` and waits for it, with every process it starts marked as `tool`'s: before the
 * call what a crashed run of `tool` left is killed, and after it whatever the command left
 * running, because a timeout kills the direct child only. Each kill is named on stderr. Without an
 * env in `options` the command gets this process's. */
export function spawnMarked(
  tool: string,
  command: string,
  args: readonly string[],
  options: Omit<SpawnSyncOptionsWithStringEncoding, "encoding">,
): SpawnSyncReturns<string> {
  reapNamed(tool, orphaned(tool), LEFT_BY_CRASH);
  const result = spawnSync(command, [...args], {
    ...options,
    encoding: "utf8",
    env: { ...(options.env ?? process.env), ...ownerEnv(tool) },
  });
  reapNamed(tool, owned(tool), `left running by ${command}`);
  return result;
}

/** A fresh temp directory under `base` named `<tool>.<this pid>.<random>`, so a later run can tell
 * whose it is; the caller removes it in a finally, and `sweepTempDirs` removes it after a crash. */
export function runTempDir(tool: string, base: string = tmpdir()): string {
  return mkdtempSync(join(base, `${tool}.${process.pid}.`));
}

/** The temp directories under `base` that runs of `tool` made and that ended without removing
 * them; a live run's directory is not listed. */
function deadRunDirs(tool: string, base: string = tmpdir()): string[] {
  const prefix = `${tool}.`;
  return readdirSync(base)
    .filter((name) => name.startsWith(prefix))
    .filter((name) => {
      const pid = Number(name.slice(prefix.length).split(".")[0]);
      return Number.isInteger(pid) && !isAlive(pid);
    })
    .map((name) => join(base, name));
}

/** Removes the directories `deadRunDirs` lists and answers their paths. */
function sweepTempDirs(tool: string, base: string = tmpdir()): string[] {
  const swept = deadRunDirs(tool, base);
  for (const dir of swept) {
    rmSync(dir, { recursive: true, force: true });
  }
  return swept;
}

/** `sweepTempDirs` that names each removed directory on stderr as `<tool>: removed <dir>, <why>`. */
export function sweepNamed(tool: string, base: string = tmpdir(), why = LEFT_BY_CRASH): void {
  for (const dir of sweepTempDirs(tool, base)) {
    console.error(`${tool}: removed ${dir}, ${why}`);
  }
}
