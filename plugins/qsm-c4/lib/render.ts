// The render verb: every view of the graph, written beside it, or compared with what is there
// under --check, once the full lint passes.
import { type Finding, renderOutcome, type Settled } from "../../../lib/model-graph.ts";
import type { Outcome } from "../../../lib/outcome.ts";
import { lintRead } from "./c4/lint.ts";
import { modelOrThrow, readC4 } from "./c4/model.ts";
import { renderC4 } from "./c4/render.ts";
import { C4 } from "./notation.ts";

export async function renderFile(
  file: string,
  check: boolean,
): Promise<Outcome<Settled | { findings: Finding[] }>> {
  // the source is read once: the lint and the views both use it
  const read = await readC4(file);
  return renderOutcome(C4, file, check, lintRead(file, read), () =>
    renderC4(modelOrThrow(file, read), C4.project(file)),
  );
}
