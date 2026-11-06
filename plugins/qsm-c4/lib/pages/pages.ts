// pages: one self-contained HTML of the C4 graph, so the owner reads it in a browser with nothing
// to install and no server: every generated view inside, each zoom link turned into a link within
// the page.
import { join } from "node:path";
import { escapeHtml as esc, fillTemplate, writePage } from "../../../../lib/html.ts";
import {
  type Finding,
  formatFinding,
  projectGraph,
  projectOf,
} from "../../../../lib/model-graph.ts";
import { fail, ok, type Outcome } from "../../../../lib/outcome.ts";
import c4Template from "../../pages/c4.html.txt" with { type: "text" };
import { lintRead } from "../c4/lint.ts";
import { type C4Model, modelOrThrow, readC4 } from "../c4/model.ts";
import { renderC4 } from "../c4/render.ts";

async function c4Page(file: string, model: C4Model): Promise<string> {
  const project = projectOf(file, ".c4");
  // the draw.io diagram is for draw.io; the page shows the picture only
  const views = await renderC4(model, project, false);
  const viewOf = (name: string): string => name.slice(project.length + 1, -".drawio.svg".length);
  const sections = views.map((v) => {
    const svg = v.svg.replaceAll(
      /href="([^"#]+\.drawio\.svg)"/g,
      (_, target: string) => `href="#${viewOf(target)}"`,
    );
    return `<section data-view="${esc(viewOf(v.name))}" data-title="${esc(v.title)}">${svg}</section>`;
  });
  return fillTemplate(c4Template, {
    "<!--PROJECT-->": esc(project),
    "<!--VIEWS-->": sections.join("\n"),
  });
}

export async function writePages(
  root: string,
  out: string | undefined,
): Promise<Outcome<{ written: string[]; findings: Finding[] }>> {
  const c4 = projectGraph(root, ".c4");
  // the source is read once: the lint and the page both use it
  const c4Read = await readC4(c4);
  const findings = lintRead(c4, c4Read);
  if (findings.length > 0) {
    return fail("worse", `no page written: ${findings.map(formatFinding).join("\n")}`, {
      written: [],
      findings,
    });
  }
  const html = await c4Page(c4, modelOrThrow(c4, c4Read));
  const page = writePage(out ?? join(root, ".qsm", "c4"), "c4.html", html);
  return ok({ written: [page.path], findings }, page.line);
}
