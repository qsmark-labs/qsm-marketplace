// BPMN as qsm-bpmn serves it: the graph file and the pictures beside it.
import { notation } from "../../../lib/model-graph.ts";

/** A process picture is `<project>.*.svg`; a C4 view, `<project>.*.drawio.svg`, is another
 * notation's. */
export const BPMN = notation({
  ext: ".bpmn",
  tool: "qsm-bpmn",
  owns: (file) => file.endsWith(".svg") && !file.endsWith(".drawio.svg"),
});
