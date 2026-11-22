// A routed session must not let Claude's /model write into the person's settings. Each launch gets
// its own home; when its claude ends only what qsm-ccr put there is removed, and what Claude wrote
// (history, plans, transcripts) stays.
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  claudeDir,
  claudeJsonPath,
  type Env,
  liveClaudeDirs,
  withClaudeDirAt,
} from "../../../lib/paths.ts";
import { fromThrown } from "../../../lib/qsm-error.ts";
import { deadRunDirs, runTempDir } from "../../../lib/reap.ts";
import type { Places } from "./places.ts";

const SOURCE_DIR = "QSM_CCR_SOURCE_CLAUDE_DIR";
const SOURCE_JSON = "QSM_CCR_SOURCE_CLAUDE_JSON";
const SHARED = [
  ".credentials.json",
  "CLAUDE.md",
  "rules",
  "skills",
  "plugins",
  "output-styles",
  "statusline.sh",
];
const COPIED = ["settings.json", ".claude.json"];
const LINKED = ["projects", ...SHARED, "teams", "tasks"];
const HOME_TOOL = "session";
/** The name a cleaned home that still holds what Claude wrote takes in place of `session`. */
const KEPT = "kept";

export function isIsolated(env: Env): boolean {
  return env[SOURCE_DIR] !== undefined;
}

/** Removes what `fillHome` put in `dir`: the copied settings and the symlinks it made, never what a
 * link points at and never a real directory of the same name, which Claude wrote. Then the
 * directory goes if nothing is left in it; one that holds what Claude wrote is renamed to
 * `kept.<pid>.<random>`, so no later launch's sweep lists it again. Each step is named on stderr. */
function removeMade(dir: string, why: string): void {
  for (const name of [...COPIED, ...LINKED]) {
    const path = join(dir, name);
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat !== undefined && (stat.isSymbolicLink() || (stat.isFile() && COPIED.includes(name)))) {
      unlinkSync(path);
      console.error(`${HOME_TOOL}: removed ${path}, ${why}`);
    }
  }
  if (readdirSync(dir).length === 0) {
    rmdirSync(dir);
    console.error(`${HOME_TOOL}: removed ${dir}, ${why}`);
    return;
  }
  const kept = basename(dir).startsWith(`${HOME_TOOL}.`) ? keptName(dir) : dir;
  if (kept !== dir) {
    renameSync(dir, kept);
  }
  console.error(`${HOME_TOOL}: kept ${kept}, it holds what Claude wrote`);
}

/** Removes what qsm-ccr made in the home an `isolatedHome` environment names. Only a directory
 * directly under the homes root is touched: the person's own Claude home never is. */
export function removeHome(env: Record<string, string>, places: Places): void {
  const dir = claudeDir(env);
  if (dirname(dir) !== join(places.stateDir, "homes")) {
    throw new Error(`${dir} is not a home qsm-ccr made, so it is not removed`);
  }
  removeMade(dir, "its claude ended");
}

/** `removeHome` for a `finally`: a failure is named on stderr and never replaces the exit code of
 * the claude that ran. */
export function endHome(env: Record<string, string>, places: Places): void {
  try {
    removeHome(env, places);
  } catch (error) {
    const failed = fromThrown(error);
    console.error(`${HOME_TOOL}: could not clean the home: ${failed.message}`);
  }
}

/** Cleans `dirs`, the homes of launches that died: what qsm-ccr made goes, what Claude wrote stays,
 * and a home a live claude still has as its Claude home is left alone (a killed wrapper leaves its
 * claude running). With `dryRun` it only answers which homes it would clean. Answers those homes. */
function sweep(dirs: readonly string[], why: string, dryRun = false): string[] {
  const live = dirs.length === 0 ? new Set<string>() : liveClaudeDirs();
  const found = dirs.filter((dir) => !live.has(dir));
  for (const dir of dryRun ? [] : found) {
    const claimed = claim(dir);
    if (claimed !== null) {
      removeMade(claimed, why);
    }
  }
  return found;
}

/** Cleans the homes of the shape before the pid name, `session-<random>`. */
export function cleanOldHomes(places: Places, dryRun: boolean): string[] {
  const root = join(places.stateDir, "homes");
  if (!existsSync(root)) {
    return [];
  }
  const old = readdirSync(root)
    .filter((name) => name.startsWith(`${HOME_TOOL}-`))
    .map((name) => join(root, name));
  return sweep(old, "left by a launch of the shape before the pid name", dryRun);
}

/** Takes a dead launch's home for this sweep by renaming it to its `kept` name, and answers that
 * path. Teammates a lead starts together sweep at once, and a rename has one winner: the others
 * find the home gone, ENOENT, and answer null, because another launch is cleaning it. */
function claim(dir: string): string | null {
  const kept = keptName(dir);
  try {
    renameSync(dir, kept);
    return kept;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/** `<root>/kept.<pid>.<random>` for `<root>/session.<pid>.<random>`. */
function keptName(dir: string): string {
  return join(dirname(dir), `${KEPT}${basename(dir).slice(HOME_TOOL.length)}`);
}

/** Makes this launch's private home: a copy of the settings, links to the shared directories, and
 * first cleans the homes of launches that died. */
export function isolatedHome(env: Env, places: Places): Record<string, string> {
  const root = join(places.stateDir, "homes");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  sweep(deadRunDirs(HOME_TOOL, root), "left by a launch that ended before its cleanup");
  const dir = runTempDir(HOME_TOOL, root);
  try {
    return fillHome(env, places, dir);
  } catch (error) {
    removeMade(dir, "the launch failed");
    throw error;
  }
}

function fillHome(env: Env, places: Places, dir: string): Record<string, string> {
  const source = env[SOURCE_DIR] ?? claudeDir(env);
  const sourceJson = env[SOURCE_JSON] ?? claudeJsonPath(env);
  const teamHome = claudeDir(env);
  const projects = join(places.stateDir, "projects");
  mkdirSync(projects, { recursive: true, mode: 0o700 });
  symlinkSync(projects, join(dir, "projects"));
  for (const [from, name] of [
    [join(source, "settings.json"), "settings.json"],
    [sourceJson, ".claude.json"],
  ] as const) {
    if (existsSync(from)) {
      const dest = join(dir, name);
      copyFileSync(from, dest);
      chmodSync(dest, 0o600);
    }
  }
  for (const name of SHARED) {
    const from = join(source, name);
    if (existsSync(from)) {
      symlinkSync(from, join(dir, name));
    }
  }
  for (const name of ["teams", "tasks"]) {
    const from = join(teamHome, name);
    if (existsSync(from)) {
      // the real directory, not the entry in the lead's home: that entry is a link the lead's end
      // removes, and a teammate that outlives its lead keeps these two
      symlinkSync(realpathSync(from), join(dir, name));
    }
  }
  const out = withClaudeDirAt(env, dir);
  out[SOURCE_DIR] = source;
  out[SOURCE_JSON] = sourceJson;
  return out;
}
