// Where the graphs are: the files a verb was pointed at, and a project's one graph of each kind.
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { QsmError } from "../../../lib/qsm-error.ts";

export const MODELS_DIR = "models";

/** The name of a graph file: `.bpmn` or `.c4`. */
export const GRAPH_FILE = /\.(bpmn|c4)$/;

/** The `.bpmn` and `.c4` files of a path: the file itself, or those directly in the directory. */
export function graphFiles(path: string): string[] {
  if (!existsSync(path)) {
    throw new QsmError("failed", `${path} does not exist`, {
      next: "point the verb at a .bpmn or .c4 file or at models/",
    });
  }
  if (statSync(path).isFile()) {
    if (!GRAPH_FILE.test(path)) {
      throw new QsmError("usage", `${path} is neither a .bpmn nor a .c4 file`);
    }
    return [path];
  }
  const files = readdirSync(path)
    .filter((f) => GRAPH_FILE.test(f))
    .toSorted()
    .map((f) => join(path, f));
  if (files.length === 0) {
    throw new QsmError("failed", `${path} holds no .bpmn and no .c4 graph`);
  }
  return files;
}

/** The project name a graph file carries: `models/<project>.bpmn`. */
export const projectOf = (file: string): string => basename(file).replace(GRAPH_FILE, "");

/** The one graph of a kind in a directory; none or two is a failure that names the directory. */
export function oneGraph(dir: string, ext: ".bpmn" | ".c4"): string {
  const found = graphFiles(dir).filter((f) => f.endsWith(ext));
  const [first] = found;
  if (found.length !== 1 || first === undefined) {
    throw new QsmError("failed", `${dir} holds ${found.length} ${ext} graphs: a project has one`);
  }
  return first;
}

/** The graph of a kind in a directory, or nothing when the directory or the kind is absent; two
 * or more is a failure. */
export function graphIn(dir: string, ext: ".bpmn" | ".c4"): string | undefined {
  return existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(ext))
    ? oneGraph(dir, ext)
    : undefined;
}

/** The graphs of a project under `models/`: at least one, or the call fails naming `models/`. */
export function projectGraphs(root: string): { bpmn: string | undefined; c4: string | undefined } {
  const dir = join(root, MODELS_DIR);
  const bpmn = graphIn(dir, ".bpmn");
  const c4 = graphIn(dir, ".c4");
  if (bpmn === undefined && c4 === undefined) {
    throw new QsmError(
      "failed",
      `${MODELS_DIR}/ holds no graph: no ${MODELS_DIR}/<project>.bpmn and no ${MODELS_DIR}/<project>.c4`,
    );
  }
  return { bpmn, c4 };
}
