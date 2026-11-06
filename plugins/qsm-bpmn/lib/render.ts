// The render verb: every picture of the graph, written beside it, or compared with what is there
// under --check.
import { readFileSync } from "node:fs";
import { projectOf } from "../../../lib/model-graph.ts";
import type { Outcome } from "../../../lib/outcome.ts";
import { type Settled, settlePictures } from "../../../lib/pictures.ts";
import { readGraph } from "./bpmn/model.ts";
import { renderBpmn } from "./bpmn/render.ts";

/** A process picture beside the graph; a C4 view, `<project>.*.drawio.svg`, is another notation's. */
const owns = (file: string): boolean => file.endsWith(".svg") && !file.endsWith(".drawio.svg");

export async function renderFile(file: string, check: boolean): Promise<Outcome<Settled>> {
  const project = projectOf(file, ".bpmn");
  const pictures = await renderBpmn(await readGraph(file), readFileSync(file, "utf8"), project);
  return settlePictures(file, project, pictures, check, { tool: "qsm-bpmn", owns });
}
