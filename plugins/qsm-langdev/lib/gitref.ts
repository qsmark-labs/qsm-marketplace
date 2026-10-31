// The one place git is run, and the types of a tree a comparison reads. The environment policy: a
// git command on the repository inherits this process's environment, so a hook-time run reads the
// index git handed the hook (GIT_INDEX_FILE: for `git commit <paths>` that is the index of what
// will be committed, not the whole staged set). A command in a scratch directory, and a checker
// scoring one, gets `scratchEnv`, so that index never leaks into a repository it is not about.

import { spawnSync } from "node:child_process";
import { QsmError } from "../../../lib/qsm-error.ts";
import { timedOut } from "./process.ts";
import { POINTS } from "./registry.ts";

declare const shaBrand: unique symbol;

/** A commit id git resolved: made only by `resolveRef`, so no other string stands for a commit. */
export type Sha = string & { readonly [shaBrand]: true };

/** One side of a comparison: the staged tree, or the tree of a commit. */
export type TreeSide = { kind: "index" } | { kind: "commit"; sha: Sha };

const isSha = (text: string): text is Sha => /^[0-9a-f]{40,64}$/.test(text);

// A git hook exports these into its children so git can find the repository without a cwd inside
// its work tree.
const GIT_REPO_ENV_KEYS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_PREFIX",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
] as const;

/** This process's environment without the variables that name a repository, plus `extra`: for a
 * command in a scratch directory, and for a checker that runs `git ls-files` there. */
export function scratchEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of GIT_REPO_ENV_KEYS) {
    delete env[key];
  }
  return { ...env, ...extra };
}

/** What a git command answered: its exit status (null when it could not start or was killed), and
 * its output. */
export interface GitRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** `git -C root args`; `input` goes to its stdin, `env` replaces the inherited environment, and
 * `timeoutMs` is the limit (the commit point's, as for every process) after which git is killed and
 * the call fails loud. git stays synchronous: it is local plumbing. */
export function git(
  root: string,
  args: readonly string[],
  options: { input?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): GitRun {
  const timeoutMs = options.timeoutMs ?? POINTS["pre-commit"].timeoutMs;
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    ...(options.input === undefined ? {} : { input: options.input }),
    ...(options.env === undefined ? {} : { env: options.env }),
  });
  if (timedOut(result)) {
    throw new QsmError(
      "failed",
      `git ${args[0] ?? ""} did not finish within ${(timeoutMs / 1000).toFixed(1)}s`,
      { next: "check that the repository and its filesystem respond, then run it again" },
    );
  }
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/** `ref` as a commit id, or null when it names none (including "no commits
 * yet", which is not an error — a fresh repository has no HEAD). */
export function resolveRef(root: string, ref: string): Sha | null {
  const result = git(root, ["rev-parse", "--verify", "-q", ref]);
  const id = result.stdout.trim();
  return result.status === 0 && isSha(id) ? id : null;
}
