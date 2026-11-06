// What every qsm-models test starts from: the real entry, the marketplace's own graphs, and its
// planning process cut out of the one BPMN graph as a file of its own.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CLI = resolve(import.meta.dir, "../cli.ts");
const MODELS = resolve(import.meta.dir, "../../../../models");
export const GRAPH = readFileSync(resolve(MODELS, "marketplace.bpmn"), "utf8");
export const C4 = readFileSync(resolve(MODELS, "marketplace.c4"), "utf8");

/** The one element of the graph that starts with `open` and ends with its closing tag. */
function slice(open: string, close: string): string {
  const at = GRAPH.indexOf(open);
  const end = GRAPH.indexOf(close, at);
  if (at < 0 || end < 0) {
    throw new Error(`models/marketplace.bpmn has no ${open}`);
  }
  return GRAPH.slice(at, end + close.length);
}

/** The planning process with its pool and its diagram, in the graph's own definitions. */
export const PLAN = [
  GRAPH.slice(0, GRAPH.indexOf("<bpmn:collaboration")),
  slice('<bpmn:collaboration id="plan_collab">', "</bpmn:collaboration>"),
  slice('<bpmn:process id="plan_process"', "</bpmn:process>"),
  slice('<bpmndi:BPMNDiagram id="BPMNDiagram_plan_collab">', "</bpmndi:BPMNDiagram>"),
  "</bpmn:definitions>\n",
].join("\n");
