// pages: one self-contained HTML of the BPMN graph, so the owner reads it in a browser with nothing
// to install and no server: bpmn-js's viewer with the graph inside.
import viewerJs from "bpmn-js/dist/bpmn-navigated-viewer.production.min.js" with { type: "text" };
import bpmnCss from "bpmn-js/dist/assets/bpmn-js.css" with { type: "text" };
import diagramCss from "bpmn-js/dist/assets/diagram-js.css" with { type: "text" };
import { escapeHtml as esc, fillTemplate } from "../../../../lib/html.ts";
import { type Finding, pageOutcome } from "../../../../lib/model-graph.ts";
import type { Outcome } from "../../../../lib/outcome.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import bpmnTemplate from "../../pages/bpmn.html.txt" with { type: "text" };
import { type Graph, readGraph } from "../bpmn/model.ts";
import { lintGraph } from "../lint.ts";
import { BPMN } from "../notation.ts";

/** Text inside a script element: the one sequence that would end it early is refused. */
function scriptText(text: string, what: string): string {
  if (text.toLowerCase().includes("</script")) {
    throw new QsmError(
      "failed",
      `${what} holds "</script", which would end the page's script early`,
    );
  }
  return text;
}

function bpmnPage(graph: Graph): string {
  return fillTemplate(bpmnTemplate, {
    "/*BPMN-JS-CSS*/": `${diagramCss}\n${bpmnCss}`,
    "<!--PROJECT-->": esc(BPMN.project(graph.file)),
    "<!--GRAPH-->": scriptText(graph.xml, graph.file),
    "/*BPMN-JS*/": scriptText(viewerJs, "bpmn-js"),
  });
}

export async function writePages(
  repo: string,
  out: string | undefined,
): Promise<Outcome<{ written: string[]; findings: Finding[] }>> {
  const graph = await readGraph(BPMN.projectGraph(repo));
  return pageOutcome(BPMN, repo, out, await lintGraph(graph), () => bpmnPage(graph));
}
