// What every qsm-bpmn test starts from: the real entry, the marketplace's own graph, and its
// planning process cut out of the one BPMN graph as a file of its own.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CLI = resolve(import.meta.dir, "../cli.ts");
const MODELS = resolve(import.meta.dir, "../../../../models");
/** The marketplace graph as the tests start from it: its lanes link C4 actors, a link that only
 * resolves beside the real C4 graph, so the copy a test writes elsewhere carries none. */
export const GRAPH = readFileSync(resolve(MODELS, "marketplace.bpmn"), "utf8")
  .replaceAll(/ c4:element="[^"]*"/g, "")
  .replace(' xmlns:c4="https://c4model.com"', "");

/** The one element of the graph that starts with `open` and ends with its closing tag. */
function slice(open: string, close: string): string {
  const at = GRAPH.indexOf(open);
  const end = GRAPH.indexOf(close, at);
  if (at < 0 || end < 0) {
    throw new Error(`models/marketplace.bpmn has no ${open}`);
  }
  return GRAPH.slice(at, end + close.length);
}

/** The planning process with its pool and its diagram, in the graph's own definitions; its call
 * activity calls the planning process itself, so the file is complete alone. */
export const PLAN = [
  GRAPH.slice(0, GRAPH.indexOf("<bpmn:collaboration")),
  slice('<bpmn:collaboration id="plan_collab">', "</bpmn:collaboration>"),
  slice('<bpmn:process id="plan_process"', "</bpmn:process>"),
  slice('<bpmndi:BPMNDiagram id="BPMNDiagram_plan_collab">', "</bpmndi:BPMNDiagram>"),
  "</bpmn:definitions>\n",
]
  .join("\n")
  .replace('calledElement="model_gate_process"', 'calledElement="plan_process"')
  .replace('calledElement="record_plan_process"', 'calledElement="plan_process"')
  .replace('calledElement="decouple_process"', 'calledElement="plan_process"');
