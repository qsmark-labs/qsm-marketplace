// A project's one model graph of a notation: where its file is, and how a lint of it reports. A
// project keeps one graph per notation, `models/<project><ext>`, so a directory holding two fails.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fail, ok, type Outcome } from "./outcome.ts";
import { QsmError } from "./qsm-error.ts";

const MODELS_DIR = "models";

/** The repository the working directory is in; `tool` names the binary the user runs there. */
export function repoRoot(tool: string, cwd: string = process.cwd()): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new QsmError("failed", `${cwd} is not inside a git repository`, {
      next: `run ${tool} in the project's checkout`,
    });
  }
  return r.stdout.trim();
}

/** The project's `models/` in the checkout the working directory is in, relative to it so
 * findings stay short. */
export function modelsDir(tool: string): string {
  return relative(process.cwd(), join(repoRoot(tool), MODELS_DIR)) || ".";
}

/** The one graph of `ext` directly in a directory; none or two is a failure that names it. */
function oneGraph(dir: string, ext: string): string {
  const found = readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .toSorted()
    .map((f) => join(dir, f));
  const [first] = found;
  if (found.length !== 1 || first === undefined) {
    throw new QsmError("failed", `${dir} holds ${found.length} ${ext} graphs: a project has one`);
  }
  return first;
}

/** The graph a verb was pointed at: the file itself, or the one graph of `ext` in the directory. */
export function graphOf(path: string, ext: string): string {
  if (!existsSync(path)) {
    throw new QsmError("failed", `${path} does not exist`, {
      next: `point the verb at a ${ext} file or at ${MODELS_DIR}/`,
    });
  }
  if (!statSync(path).isFile()) {
    return oneGraph(path, ext);
  }
  if (!path.endsWith(ext)) {
    throw new QsmError("usage", `${path} is not a ${ext} file`);
  }
  return path;
}

/** The project name a graph file carries: `models/<project><ext>`. */
export const projectOf = (file: string, ext: string): string => basename(file, ext);

/** The graph of `ext` of a project under `models/`, or the call fails naming `models/`. */
export function projectGraph(root: string, ext: string): string {
  const dir = join(root, MODELS_DIR);
  if (!existsSync(dir) || !readdirSync(dir).some((f) => f.endsWith(ext))) {
    throw new QsmError("failed", `${MODELS_DIR}/ holds no graph: no ${MODELS_DIR}/<project>${ext}`);
  }
  return oneGraph(dir, ext);
}

/** One finding: the file, the element, the rule and what is wrong. */
export interface Finding {
  readonly file: string;
  readonly id: string;
  readonly rule: string;
  readonly message: string;
}

export const formatFinding = (f: Finding): string => `${f.file}: ${f.id}: ${f.message} (${f.rule})`;

/** What a lint of one graph returns: `worse` naming every finding, or clean. */
export function lintOutcome(
  file: string,
  findings: readonly Finding[],
): Outcome<{ findings: Finding[] }> {
  if (findings.length > 0) {
    return fail("worse", findings.map(formatFinding).join("\n"), { findings: [...findings] });
  }
  return ok({ findings: [] }, `${file}: clean`);
}
