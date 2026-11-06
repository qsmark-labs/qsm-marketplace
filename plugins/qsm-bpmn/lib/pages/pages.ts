// pages: one self-contained HTML of the BPMN graph, so the owner reads it in a browser with nothing
// to install and no server: bpmn-js's viewer with the graph inside.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import viewerJs from "bpmn-js/dist/bpmn-navigated-viewer.production.min.js" with { type: "text" };
import bpmnCss from "bpmn-js/dist/assets/bpmn-js.css" with { type: "text" };
import diagramCss from "bpmn-js/dist/assets/diagram-js.css" with { type: "text" };
import { escapeHtml as esc, fillTemplate, writePage } from "../../../../lib/html.ts";
import {
  type Finding,
  formatFinding,
  projectGraph,
  projectOf,
} from "../../../../lib/model-graph.ts";
import { fail, ok, type Outcome } from "../../../../lib/outcome.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import bpmnTemplate from "../../pages/bpmn.html.txt" with { type: "text" };
import { lintFile } from "../lint.ts";

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

function bpmnPage(file: string): string {
  return fillTemplate(bpmnTemplate, {
    "/*BPMN-JS-CSS*/": `${diagramCss}\n${bpmnCss}`,
    "<!--PROJECT-->": esc(projectOf(file, ".bpmn")),
    "<!--GRAPH-->": scriptText(readFileSync(file, "utf8"), file),
    "/*BPMN-JS*/": scriptText(viewerJs, "bpmn-js"),
  });
}

export async function writePages(
  root: string,
  out: string | undefined,
): Promise<Outcome<{ written: string[]; findings: Finding[] }>> {
  const bpmn = projectGraph(root, ".bpmn");
  const findings = await lintFile(bpmn);
  if (findings.length > 0) {
    return fail("worse", `no page written: ${findings.map(formatFinding).join("\n")}`, {
      written: [],
      findings,
    });
  }
  const page = writePage(out ?? join(root, ".qsm", "bpmn"), "bpmn.html", bpmnPage(bpmn));
  return ok({ written: [page.path], findings }, page.line);
}
