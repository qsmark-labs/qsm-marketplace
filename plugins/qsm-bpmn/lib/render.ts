// The render verb: every picture of the graph, written beside it, or compared with what is there
// under --check, once the full lint passes.
import { type Finding, renderOutcome, type Settled } from "../../../lib/model-graph.ts";
import type { Outcome } from "../../../lib/outcome.ts";
import { readGraph } from "./bpmn/model.ts";
import { renderBpmn } from "./bpmn/render.ts";
import { lintGraph } from "./lint.ts";
import { BPMN } from "./notation.ts";

export async function renderFile(
  file: string,
  check: boolean,
): Promise<Outcome<Settled | { findings: Finding[] }>> {
  const graph = await readGraph(file);
  return renderOutcome(BPMN, file, check, await lintGraph(graph), () =>
    renderBpmn(graph, BPMN.project(file)),
  );
}
