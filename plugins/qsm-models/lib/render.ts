// The render verb: every picture of the graphs of a path, written beside each graph, or compared
// with what is there under --check.
import { existsSync, readFileSync } from "node:fs";
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

export async function renderPath(
  path: string,
  check: boolean,
): Promise<Outcome<{ written: string[]; stale: string[] }>> {
  const written: string[] = [];
  const stale: string[] = [];
  for (const file of graphFiles(path)) {
    for (const p of await picturesOf(file)) {
      const out = join(dirname(file), p.name);
      if (check) {
        if (!existsSync(out) || readFileSync(out, "utf8") !== p.svg) {
          stale.push(out);
        }
      } else {
        writeAtomic(out, p.svg);
        written.push(out);
      }
    }
  }
  if (stale.length > 0) {
    return fail("worse", `stale, run qsm-models render: ${stale.join(", ")}`, { written, stale });
  }
  return ok({ written, stale }, check ? "every picture is current" : `wrote ${written.join(", ")}`);
}
