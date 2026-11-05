// The render verb: every picture of the graphs of a path, written beside each graph, or compared
// with what is there under --check.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeAtomic } from "../../../lib/fs.ts";
import { fail, ok, type Outcome } from "../../../lib/outcome.ts";
import { readGraph } from "./bpmn/model.ts";
import { renderBpmn } from "./bpmn/render.ts";
import { readC4OrThrow } from "./c4/model.ts";
import { renderC4 } from "./c4/render.ts";
import { graphFiles, projectOf } from "./graphs.ts";
import type { Picture } from "./svg.ts";

/** The pictures of one graph file; a C4 source LikeC4 refuses renders nothing and says why. */
async function picturesOf(file: string): Promise<Picture[]> {
  if (file.endsWith(".bpmn")) {
    const graph = await readGraph(file);
    return renderBpmn(graph, readFileSync(file, "utf8"), projectOf(file));
  }
  return renderC4(await readC4OrThrow(file), projectOf(file));
}

/** The pictures beside a graph that carry its project's name and kind but that no render writes:
 * `<project>.*.svg` for a BPMN graph, `<project>.*.drawio.svg` for a C4 graph. */
function orphansOf(file: string, pictures: readonly Picture[]): string[] {
  const dir = dirname(file);
  const prefix = `${projectOf(file)}.`;
  const drawio = file.endsWith(".c4");
  const current = new Set(pictures.map((p) => p.name));
  return readdirSync(dir)
    .filter(
      (f) =>
        f.startsWith(prefix) &&
        f.endsWith(".svg") &&
        f.endsWith(".drawio.svg") === drawio &&
        !current.has(f),
    )
    .toSorted()
    .map((f) => join(dir, f));
}

interface Result {
  written: string[];
  stale: string[];
  orphans: string[];
}

/** One graph's pictures settled: under `check` each wrong picture is named stale; otherwise every
 * picture is written. An orphan is only named, never deleted, because a file that merely carries
 * the project's name may be one the person made. */
function settle(file: string, pictures: readonly Picture[], check: boolean, into: Result): void {
  into.orphans.push(...orphansOf(file, pictures));
  for (const p of pictures) {
    const out = join(dirname(file), p.name);
    if (!check) {
      writeAtomic(out, p.svg);
      into.written.push(out);
    } else if (!existsSync(out) || readFileSync(out, "utf8") !== p.svg) {
      into.stale.push(out);
    }
  }
}

export async function renderPath(path: string, check: boolean): Promise<Outcome<Result>> {
  const result: Result = { written: [], stale: [], orphans: [] };
  for (const file of graphFiles(path)) {
    settle(file, await picturesOf(file), check, result);
  }
  const { written, stale, orphans } = result;
  const problems = [
    ...(stale.length > 0 ? [`stale, run qsm-models render: ${stale.join(", ")}`] : []),
    ...(orphans.length > 0
      ? [`no render writes these, delete them if they are old pictures: ${orphans.join(", ")}`]
      : []),
  ];
  if (problems.length > 0) {
    return fail("worse", problems.join("\n"), result);
  }
  return ok(result, check ? "every picture is current" : `wrote ${written.join(", ")}`);
}
