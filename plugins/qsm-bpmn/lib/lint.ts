// The lint verb: the graph through every check of BPMN, its C4 ids included.
import type { Finding } from "../../../lib/model-graph.ts";
import { c4Findings } from "./c4-ids.ts";
import { lintBpmn } from "./bpmn/lint.ts";
import { readGraph } from "./bpmn/model.ts";

export async function lintFile(file: string): Promise<Finding[]> {
  const graph = await readGraph(file);
  return [...(await lintBpmn(file, graph.defs)), ...c4Findings(graph)];
}
