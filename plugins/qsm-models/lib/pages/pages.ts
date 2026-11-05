// pages: one self-contained HTML per graph kind, so the owner reads the models in a browser with
// nothing to install and no server: bpmn.html is bpmn-js's viewer with the graph inside, c4.html
// every generated C4 view inside, each zoom link turned into a link within the page.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import viewerJs from "bpmn-js/dist/bpmn-navigated-viewer.production.min.js" with { type: "text" };
import bpmnCss from "bpmn-js/dist/assets/bpmn-js.css" with { type: "text" };
import diagramCss from "bpmn-js/dist/assets/diagram-js.css" with { type: "text" };
import { fail, ok, type Outcome } from "../../../../lib/outcome.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import bpmnTemplate from "../../pages/bpmn.html.txt" with { type: "text" };
import c4Template from "../../pages/c4.html.txt" with { type: "text" };
import { readC4 } from "../c4/model.ts";
import { renderC4 } from "../c4/render.ts";
import { type Finding, formatFinding } from "../bpmn/lint.ts";
import { MODELS_DIR, oneGraph, projectOf } from "../graphs.ts";
import { lintFile } from "../lint.ts";

/** Fills each `marker` of a template once, the value taken literally. */
function fill(template: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce((page, [marker, value]) => {
    const parts = page.split(marker);
    if (parts.length !== 2) {
      throw new Error(`a page template holds ${marker} ${parts.length - 1} times, not once`);
    }
    return parts.join(value);
  }, template);
}

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
  return fill(bpmnTemplate, {
    "/*BPMN-JS-CSS*/": `${diagramCss}\n${bpmnCss}`,
    "<!--PROJECT-->": projectOf(file),
    "<!--GRAPH-->": scriptText(readFileSync(file, "utf8"), file),
    "/*BPMN-JS*/": scriptText(viewerJs, "bpmn-js"),
  });
}

async function c4Page(file: string): Promise<string> {
  const read = await readC4(file);
  if (!read.ok) {
    throw new QsmError("worse", `${file}: LikeC4 refuses it`, {
      next: "run qsm-models lint and fix the source",
    });
  }
  const project = projectOf(file);
  const views = await renderC4(read.model, project);
  const viewOf = (name: string): string => name.slice(project.length + 1, -".drawio.svg".length);
  const sections = views.map((v) => {
    const svg = v.svg
      // the draw.io diagram is for draw.io; the page shows the picture only
      .replace(/ content="[^"]*"/, "")
      .replaceAll(
        /href="([^"#]+\.drawio\.svg)"/g,
        (_, target: string) => `href="#${viewOf(target)}"`,
      );
    return `<section data-view="${viewOf(v.name)}" data-title="${v.title}">${svg}</section>`;
  });
  return fill(c4Template, { "<!--PROJECT-->": project, "<!--VIEWS-->": sections.join("\n") });
}

/** The graphs of a project under `models/`: at least one, or the call fails naming `models/`. */
function graphsOf(root: string): { bpmn: string | undefined; c4: string | undefined } {
  const dir = join(root, MODELS_DIR);
  const names = existsSync(dir) ? readdirSync(dir) : [];
  const one = (ext: ".bpmn" | ".c4"): string | undefined =>
    names.some((f) => f.endsWith(ext)) ? oneGraph(dir, ext) : undefined;
  const bpmn = one(".bpmn");
  const c4 = one(".c4");
  if (bpmn === undefined && c4 === undefined) {
    throw new QsmError(
      "failed",
      `${MODELS_DIR}/ holds no graph: no ${MODELS_DIR}/<project>.bpmn and no ${MODELS_DIR}/<project>.c4`,
    );
  }
  return { bpmn, c4 };
}

export async function writePages(
  root: string,
  out: string | undefined,
): Promise<Outcome<{ written: string[]; findings: Finding[] }>> {
  const { bpmn, c4 } = graphsOf(root);
  const graphs = [bpmn, c4].filter((g) => g !== undefined);
  const findings: Finding[] = [];
  for (const g of graphs) {
    findings.push(...(await lintFile(g)));
  }
  if (findings.length > 0) {
    return fail("worse", `no page written: ${findings.map(formatFinding).join("\n")}`, {
      written: [],
      findings,
    });
  }
  const dir = out ?? join(root, ".qsm", MODELS_DIR);
  const pages: [string, string][] = [
    ...(bpmn === undefined ? [] : [["bpmn.html", bpmnPage(bpmn)] as [string, string]]),
    ...(c4 === undefined ? [] : [["c4.html", await c4Page(c4)] as [string, string]]),
  ];
  mkdirSync(dir, { recursive: true });
  const written = pages.map(([name, html]) => {
    writeFileSync(join(dir, name), html);
    return join(dir, name);
  });
  const missing = [
    bpmn === undefined ? "there is no BPMN graph" : "",
    c4 === undefined ? "there is no C4 graph" : "",
  ].filter((m) => m !== "");
  const lines = [
    ...written.map(
      (w) =>
        `wrote ${relative(process.cwd(), w) || w} (${Math.round(readFileSync(w).length / 1024)} KB)`,
    ),
    ...missing,
  ];
  return ok({ written, findings }, lines.join("\n"));
}
