// The render verb: every view of the graph, written beside it, or compared with what is there
// under --check, once the full lint passes.
import { type Finding, lintOutcome, projectOf } from "../../../lib/model-graph.ts";
import type { Outcome } from "../../../lib/outcome.ts";
import { type Settled, settlePictures } from "../../../lib/pictures.ts";
import { lintRead } from "./c4/lint.ts";
import { modelOrThrow, readC4 } from "./c4/model.ts";
import { renderC4 } from "./c4/render.ts";

/** A C4 view beside the graph; the other `.svg` files there are another notation's. */
const owns = (file: string): boolean => file.endsWith(".drawio.svg");

/** A source lint refuses renders nothing and exits as the lint did. */
export async function renderFile(
  file: string,
  check: boolean,
): Promise<Outcome<Settled | { findings: Finding[] }>> {
  // the source is read once: the lint and the views both use it
  const read = await readC4(file);
  const findings = lintRead(file, read);
  if (findings.length > 0) {
    return lintOutcome(file, findings);
  }
  const project = projectOf(file, ".c4");
  const views = await renderC4(modelOrThrow(file, read), project);
  return settlePictures(file, project, views, check, { tool: "qsm-c4", owns });
}
