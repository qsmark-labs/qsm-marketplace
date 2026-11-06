// A project's one model graph of a notation and what is made of it: where its file is, how a lint
// of it reports, the pictures a render settles beside it, and the page that shows it. A project
// keeps one graph per notation, `models/<project><ext>`, so a directory holding two fails.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { writeAtomic } from "./fs.ts";
import { writePage } from "./html.ts";
import { fail, ok, type Outcome } from "./outcome.ts";
import { QsmError } from "./qsm-error.ts";

const MODELS_DIR = "models";

/** The repository the working directory is in; `tool` names the binary the user runs there. */
function repoRoot(tool: string, cwd: string = process.cwd()): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new QsmError("failed", `${cwd} is not inside a git repository`, {
      next: `run ${tool} in the project's checkout`,
    });
  }
  return r.stdout.trim();
}

/** The graph a path names: the file itself, or the one graph of `ext` directly in the directory;
 * none or two is a failure that names the directory. */
function graphOf(path: string, ext: string): string {
  if (!existsSync(path)) {
    throw new QsmError("failed", `${path} does not exist`, {
      next: `point the verb at a ${ext} file or at ${MODELS_DIR}/`,
    });
  }
  if (statSync(path).isFile()) {
    if (!path.endsWith(ext)) {
      throw new QsmError("usage", `${path} is not a ${ext} file`);
    }
    return path;
  }
  const found = readdirSync(path)
    .filter((f) => f.endsWith(ext))
    .toSorted()
    .map((f) => join(path, f));
  const [first] = found;
  if (found.length !== 1 || first === undefined) {
    throw new QsmError("failed", `${path} holds ${found.length} ${ext} graphs: a project has one`);
  }
  return first;
}

/** One notation as a plugin serves it: the extension of its graph file, the binary that serves it,
 * and which files beside the graph are its pictures. */
interface NotationSpec {
  readonly ext: string;
  readonly tool: string;
  readonly owns: (file: string) => boolean;
}

/** A notation and the places of its graph: the root of the checkout, the graph a verb runs on (the
 * path it was given, or the one under the checkout's `models/`), a project's graph, and the
 * project name a graph file carries. */
export function notation(spec: NotationSpec) {
  const root = (): string => repoRoot(spec.tool);
  return {
    ...spec,
    root,
    graph: (path: string | undefined): string =>
      graphOf(path ?? (relative(process.cwd(), join(root(), MODELS_DIR)) || "."), spec.ext),
    projectGraph: (repo: string): string => graphOf(join(repo, MODELS_DIR), spec.ext),
    project: (file: string): string => basename(file, spec.ext),
  };
}

export type Notation = ReturnType<typeof notation>;

/** One finding: the file, the element, the rule and what is wrong. */
export interface Finding {
  readonly file: string;
  readonly id: string;
  readonly rule: string;
  readonly message: string;
}

const formatFinding = (f: Finding): string => `${f.file}: ${f.id}: ${f.message} (${f.rule})`;

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

/** One picture a render writes: the file name beside the graph, and its bytes. */
export interface Picture {
  readonly name: string;
  readonly svg: string;
}

export interface Settled {
  written: string[];
  stale: string[];
  orphans: string[];
}

/** One graph's pictures settled: under `check` each wrong picture is named stale; otherwise every
 * picture is written. An orphan is only named, never deleted, because a file that merely carries
 * the project's name may be one the person made. */
function settlePictures(
  n: Notation,
  graph: string,
  pictures: readonly Picture[],
  check: boolean,
): Outcome<Settled> {
  const dir = dirname(graph);
  const project = n.project(graph);
  const current = new Set(pictures.map((p) => p.name));
  const orphans = readdirSync(dir)
    .filter((f) => f.startsWith(`${project}.`) && n.owns(f) && !current.has(f))
    .toSorted()
    .map((f) => join(dir, f));
  const result: Settled = { written: [], stale: [], orphans };
  for (const p of pictures) {
    const out = join(dir, p.name);
    if (!check) {
      writeAtomic(out, p.svg);
      result.written.push(out);
    } else if (!existsSync(out) || readFileSync(out, "utf8") !== p.svg) {
      result.stale.push(out);
    }
  }
  const problems = [
    ...(result.stale.length > 0 ? [`stale, run ${n.tool} render: ${result.stale.join(", ")}`] : []),
    ...(orphans.length > 0
      ? [`no render writes these, delete them if they are old pictures: ${orphans.join(", ")}`]
      : []),
  ];
  if (problems.length > 0) {
    return fail("worse", problems.join("\n"), result);
  }
  return ok(result, check ? "every picture is current" : `wrote ${result.written.join(", ")}`);
}

/** A render: nothing written when the lint refuses, which is the outcome; else the pictures
 * `draw` makes, settled beside the graph. */
export async function renderOutcome(
  n: Notation,
  graph: string,
  check: boolean,
  findings: readonly Finding[],
  draw: () => Promise<readonly Picture[]>,
): Promise<Outcome<Settled | { findings: Finding[] }>> {
  if (findings.length > 0) {
    return lintOutcome(graph, findings);
  }
  return settlePictures(n, graph, await draw(), check);
}

/** A page: nothing written when the lint refuses; else the page `build` makes, written as
 * `<notation>.html` into `out` or `<repo>/.qsm/<notation>/`, replacing an earlier run. */
export async function pageOutcome(
  n: Notation,
  repo: string,
  out: string | undefined,
  findings: readonly Finding[],
  build: () => string | Promise<string>,
): Promise<Outcome<{ written: string[]; findings: Finding[] }>> {
  if (findings.length > 0) {
    return fail("worse", `no page written: ${findings.map(formatFinding).join("\n")}`, {
      written: [],
      findings: [...findings],
    });
  }
  const name = n.ext.slice(1);
  const page = writePage(out ?? join(repo, ".qsm", name), `${name}.html`, await build());
  return ok({ written: [page.path], findings: [] }, page.line);
}
