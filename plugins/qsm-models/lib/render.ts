// The render verb: every picture of the graphs of a path, written beside each graph, or compared
// with what is there under --check.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fail, ok, type Outcome } from "../../../lib/outcome.ts";
import { QsmError } from "../../../lib/qsm-error.ts";
import { readGraph } from "./bpmn/model.ts";
import { type Picture, renderBpmn } from "./bpmn/render.ts";
import { readC4 } from "./c4/model.ts";
import { renderC4 } from "./c4/render.ts";
import { graphFiles, projectOf } from "./graphs.ts";

/** The pictures of one graph file; a C4 source LikeC4 refuses renders nothing and says why. */
async function picturesOf(file: string): Promise<Picture[]> {
  if (file.endsWith(".bpmn")) {
    const graph = await readGraph(file);
    return renderBpmn(graph, readFileSync(file, "utf8"), projectOf(file));
  }
  const read = await readC4(file);
  if (!read.ok) {
    throw new QsmError(
      "worse",
      `${file}: ${read.errors.map((e) => `line ${e.line}: ${e.message}`).join("; ")}`,
      {
        next: "run qsm-models lint and fix the source",
      },
    );
  }
  return renderC4(read.model, projectOf(file));
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
        writeFileSync(out, p.svg);
        written.push(out);
      }
    }
  }
  if (stale.length > 0) {
    return fail("worse", `stale, run qsm-models render: ${stale.join(", ")}`, { written, stale });
  }
  return ok({ written, stale }, check ? "every picture is current" : `wrote ${written.join(", ")}`);
}
