// Where the store lives, and where a snapshot belongs: the project is the directory name of the
// repository's main worktree, so every worktree of one repository is one project, and the branch is
// the checked-out one.
import { spawnSync } from "node:child_process";
import { basename, dirname } from "node:path";
import { UsageError } from "../../../../lib/outcome.ts";
import { dataDir, type Env } from "../../../../lib/paths.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import { docsIn } from "./layout.ts";

/** `<data>/qsm-docs`: a directory per project, and `.kinds` for the installed kinds. */
export function docsDir(env: Env): string {
  return docsIn(dataDir(env));
}

export interface Where {
  readonly project: string;
  readonly branch: string;
}

/** git's answer in `cwd`, or null when git refused (not a repository, a detached HEAD). */
function git(cwd: string, ...args: string[]): string | null {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.error !== undefined) {
    throw new QsmError("missing", `git could not run: ${r.error.message}`, {
      next: "install git, the one program qsm-docs needs on PATH",
    });
  }
  return r.status === 0 ? r.stdout.trim() : null;
}

/** The project and branch of `cwd`, each flag winning over the checkout's own. */
export function whereOf(
  cwd: string,
  flags: { readonly project?: string | undefined; readonly branch?: string | undefined },
): Where {
  if (flags.project !== undefined && flags.branch !== undefined) {
    return { project: flags.project, branch: flags.branch };
  }
  const common = git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir");
  if (common === null) {
    throw new UsageError(
      `${cwd} is not in a git checkout: name the project and the branch with --project and --branch`,
    );
  }
  const branch = flags.branch ?? git(cwd, "symbolic-ref", "--short", "-q", "HEAD");
  if (branch === null) {
    throw new QsmError("blocked", "HEAD is detached, so no branch names this snapshot", {
      next: "check out a branch, or name one with --branch",
    });
  }
  return { project: flags.project ?? basename(dirname(common)), branch };
}
