// Where the graphs are: the files a verb was pointed at, and a project's one graph of each kind.
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { QsmError } from "../../../lib/qsm-error.ts";

export const MODELS_DIR = "models";

/** The `.bpmn` and `.c4` files of a path: the file itself, or those directly in the directory. */
export function graphFiles(path: string): string[] {
  if (!existsSync(path)) {
    throw new QsmError("failed", `${path} does not exist`, {
      next: "point the verb at a .bpmn or .c4 file or at models/",
    });
  }
  if (statSync(path).isFile()) {
    if (!/\.(bpmn|c4)$/.test(path)) {
      throw new QsmError("usage", `${path} is neither a .bpmn nor a .c4 file`);
    }
    return [path];
  }
  const files = readdirSync(path)
    .filter((f) => /\.(bpmn|c4)$/.test(f))
    .toSorted()
    .map((f) => join(path, f));
  if (files.length === 0) {
    throw new QsmError("failed", `${path} holds no .bpmn and no .c4 graph`);
  }
  return files;
}

/** The project name a graph file carries: `models/<project>.bpmn`. */
export const projectOf = (file: string): string => basename(file).replace(/\.(bpmn|c4)$/, "");

/** The one graph of a kind in a directory; none or two is a failure that names the directory. */
export function oneGraph(dir: string, ext: ".bpmn" | ".c4"): string {
  const found = graphFiles(dir).filter((f) => f.endsWith(ext));
  const [first] = found;
  if (found.length !== 1 || first === undefined) {
    throw new QsmError("failed", `${dir} holds ${found.length} ${ext} graphs: a project has one`);
  }
  return first;
}
