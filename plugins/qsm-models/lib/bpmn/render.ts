// render for BPMN: one SVG per process, drawn by bpmn-js from the graph's own geometry, with links
// between the processes, lines that read at a glance, and a legend.
import { domContainer } from "./dom.ts";
import {
  type Definitions,
  diagramOf,
  type FlowNode,
  type Graph,
  nodesOf,
  type Process,
  processesOf,
} from "./model.ts";

/** One picture a render writes: the file name beside the graph, and its bytes. */
export interface Picture {
  readonly name: string;
  readonly title: string;
  readonly svg: string;
}

interface Di {
  get(name: string): unknown;
  label?: { get(name: string): unknown };
}

interface Shown {
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly waypoints?: { x: number; y: number }[];
  readonly businessObject: FlowNode;
  readonly di: Di;
}

interface Registry {
  filter(fn: (e: Shown) => boolean): Shown[];
  getAll(): Shown[];
  getGraphics(e: Shown): SVGElement;
}

const PAD = 20;
const ARROW_MIN = 70;
const esc = (t: string): string =>
  t
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const pictureName = (project: string, processId: string): string => `${project}.${processId}.svg`;

/** Every call activity of the graph that calls a process, with the process it sits in. */
function callersOf(defs: Definitions, processId: string): { step: string; process: Process }[] {
  return processesOf(defs).flatMap((p) =>
    nodesOf(p)
      .filter((n) => n.$type === "bpmn:CallActivity" && n.calledElement === processId)
      .map((n) => ({ step: n.name ?? n.id ?? "", process: p })),
  );
}

/** Label tweaks bpmn-js has no option for: a call activity's label clear of its marker, a dark
 * step's icons white with its text, a task's label clear of its corner icon. */
function tweak(reg: Registry): void {
  for (const el of reg.filter((e) => e.type === "bpmn:CallActivity")) {
    reg
      .getGraphics(el)
      .querySelector("text.djs-label")
      ?.setAttribute("transform", "translate(0, -7)");
  }
  for (const el of reg.filter((e) => e.di.label?.get("color:color") === "#ffffff")) {
    for (const p of reg.getGraphics(el).querySelectorAll<SVGElement>(".djs-visual path")) {
      p.style.stroke = "#ffffff";
    }
  }
  for (const el of reg.filter((e) => /^bpmn:(User|Service)Task$/.test(e.type))) {
    reg
      .getGraphics(el)
      .querySelector("text.djs-label")
      ?.setAttribute("transform", "translate(0, 8)");
  }
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function bounds(reg: Registry): Box {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (x: number, y: number): void => {
    b.x0 = Math.min(b.x0, x);
    b.y0 = Math.min(b.y0, y);
    b.x1 = Math.max(b.x1, x);
    b.y1 = Math.max(b.y1, y);
  };
  for (const e of reg.getAll()) {
    if (e.waypoints !== undefined) {
      for (const p of e.waypoints) {
        add(p.x, p.y);
      }
    } else if (e.width !== undefined && e.height !== undefined && e.type !== "label") {
      add(e.x, e.y);
      add(e.x + e.width, e.y + e.height);
    }
  }
  return b;
}

const colourOf = (e: Shown, fallback: string): string => {
  const c = e.di.get("color:border-color") ?? e.di.get("bioc:stroke");
  return typeof c === "string" ? c : fallback;
};

/** A small arrow in the middle of every segment longer than 70 px, in the flow's colour. */
function directionMarks(reg: Registry): string {
  const marks: string[] = [];
  for (const e of reg.filter((x) => x.type === "bpmn:SequenceFlow")) {
    const c = colourOf(e, "#222222");
    const pts = e.waypoints ?? [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a === undefined || b === undefined) {
        continue;
      }
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < ARROW_MIN) {
        continue;
      }
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const p = (f: number, s: number): string => `${mx + ux * f - uy * s},${my + uy * f + ux * s}`;
      marks.push(`<path d="M${p(6, 0)}L${p(-5, 6)}L${p(-5, -6)}Z" fill="${c}"/>`);
    }
  }
  return `<g class="direction-marks">${marks.join("")}</g>`;
}

/** What each colour and shape of this picture means. */
function legend(reg: Registry, x: number, y: number): { svg: string; height: number } {
  const types = new Set(reg.getAll().map((e) => e.type));
  const keys: [string, string][] = reg
    .filter((e) => e.type === "bpmn:Lane")
    .map((l) => [
      colourOf(l, "#333333"),
      `${l.businessObject.name ?? ""}: its lane, its steps and the flows they start`,
    ]);
  if (types.has("bpmn:CallActivity")) {
    keys.push([
      "thick",
      "thick border: a step drawn in its own diagram; click it to open that diagram",
    ]);
  }
  if (reg.getAll().some((e) => "loopCharacteristics" in e.businessObject)) {
    keys.push(["text", "three bars: the step runs once per item, side by side"]);
  }
  if (types.has("bpmn:UserTask")) {
    keys.push(["text", "person icon: a step done by hand"]);
  }
  if (types.has("bpmn:ServiceTask")) {
    keys.push(["text", "gear icon: a step a machine runs"]);
  }
  keys.push(["text", "small arrow on a line: the way it runs; the big one is where it ends"]);
  if (types.has("bpmn:ExclusiveGateway")) {
    keys.push(["text", "diamond: one answer is taken; a loop returns through an unnamed one"]);
  }
  const height = 26 + 16 * keys.length;
  const g = [
    `<g class="legend" font-family="Arial, sans-serif"><rect x="${x}" y="${y}" width="400" height="${height}" rx="6" fill="#fafafa" stroke="#cccccc"/>`,
    `<text x="${x + 10}" y="${y + 16}" font-size="11" font-weight="bold" fill="#222222">Legend</text>`,
  ];
  keys.forEach(([c, t], i) => {
    const ky = y + 30 + i * 16;
    if (c === "thick") {
      g.push(
        `<rect x="${x + 10}" y="${ky - 10}" width="20" height="11" rx="2" fill="#ffffff" stroke="#333333" stroke-width="3"/>`,
      );
    } else if (c !== "text") {
      g.push(`<rect x="${x + 10}" y="${ky - 10}" width="20" height="11" rx="2" fill="${c}"/>`);
    }
    g.push(
      `<text x="${x + (c === "text" ? 10 : 38)}" y="${ky}" font-size="10" fill="#333333">${esc(t)}</text>`,
    );
  });
  g.push("</g>");
  return { svg: g.join(""), height };
}

/** bpmn-js names each arrow marker at random; the n-th marker becomes `marker-n`, so a render writes
 * the same bytes every time. */
function stableMarkers(svg: string): string {
  const seen = new Map<string, string>();
  return svg.replaceAll(/marker-[a-z0-9]+/g, (m) => {
    const known = seen.get(m) ?? `marker-${seen.size + 1}`;
    seen.set(m, known);
    return known;
  });
}

function pictureOf(
  svg: string,
  reg: Registry,
  defs: Definitions,
  p: Process,
  project: string,
): string {
  const b = bounds(reg);
  const processes = new Set(processesOf(defs).map((x) => x.id));
  const links = reg
    .filter((e) => e.type === "bpmn:CallActivity" && processes.has(e.businessObject.calledElement))
    .map(
      (e) =>
        `<a href="${esc(pictureName(project, e.businessObject.calledElement ?? ""))}"><title>Open the diagram of ${esc(e.businessObject.name ?? "")}</title><rect x="${e.x}" y="${e.y}" width="${e.width ?? 0}" height="${e.height ?? 0}" rx="10" fill="#ffffff" fill-opacity="0" style="cursor: pointer"/></a>`,
    );
  const callers = callersOf(defs, p.id ?? "");
  const top = callers.length > 0 ? 26 * callers.length + 8 : 0;
  callers.forEach((c, i) => {
    links.push(
      `<a href="${esc(pictureName(project, c.process.id ?? ""))}"><text x="${b.x0 - PAD + 4}" y="${b.y0 - PAD - top + 22 + 26 * i}" font-family="Arial, sans-serif" font-size="15" fill="#08427b" text-decoration="underline">&#8593; Called by "${esc(c.step)}" in ${esc(c.process.name ?? c.process.id ?? "")}</text></a>`,
    );
  });
  const w = Math.max(b.x1 - b.x0 + 2 * PAD, 440);
  const h = b.y1 - b.y0 + 2 * PAD;
  const key = legend(reg, b.x0 - PAD + 20, b.y1 + PAD);
  const fullH = top + h + key.height + 20;
  return `${stableMarkers(svg)
    .replace(
      /<svg ([^>]*?)width="[^"]*" height="[^"]*" viewBox="[^"]*"/,
      `<svg $1width="${w}" height="${fullH}" viewBox="${b.x0 - PAD} ${b.y0 - PAD - top} ${w} ${fullH}"`,
    )
    // lines 3 px wide; the arrowhead scales with the line, so it shrinks to keep its size
    .replaceAll("stroke-width: 2px; marker-end", "stroke-width: 3px; marker-end")
    .replaceAll('markerWidth="10" markerHeight="10"', 'markerWidth="7" markerHeight="7"')
    .replace(
      /<\/svg>\s*$/,
      "",
    )}<g class="diagram-links">${links.join("")}</g>${directionMarks(reg)}${key.svg}</svg>\n`;
}

/** One picture per process of the graph that has a diagram; a process without one is named. */
export async function renderBpmn(graph: Graph, xml: string, project: string): Promise<Picture[]> {
  const { default: Viewer } = await import("bpmn-js/lib/Viewer.js");
  const viewer = new Viewer({ container: domContainer() });
  await viewer.importXML(xml);
  const out: Picture[] = [];
  for (const p of processesOf(graph.defs)) {
    const d = diagramOf(graph.defs, p.id ?? "");
    if (d?.id === undefined) {
      continue;
    }
    await viewer.open(d.id);
    const reg = viewer.get<Registry>("elementRegistry");
    tweak(reg);
    const { svg } = await viewer.saveSVG();
    out.push({
      name: pictureName(project, p.id ?? ""),
      title: p.name ?? p.id ?? "",
      svg: pictureOf(svg, reg, graph.defs, p, project),
    });
  }
  return out;
}
