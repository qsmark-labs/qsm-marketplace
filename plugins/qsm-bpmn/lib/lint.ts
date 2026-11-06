// The lint verb: the graph through every check of BPMN.
import type { Finding } from "../../../lib/model-graph.ts";
import { lintBpmn } from "./bpmn/lint.ts";
import { readGraph } from "./bpmn/model.ts";

export async function lintFile(file: string): Promise<Finding[]> {
  return lintBpmn(file, (await readGraph(file)).defs);
}
