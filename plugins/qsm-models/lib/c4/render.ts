// render for C4: one view per level, generated from the graph, laid out by ELK layered in tiers
// (actors, the system in scope with its groups, external systems), drawn as an SVG that carries
// the view's draw.io diagram, with links that zoom in and out between the views.
import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { Picture } from "../bpmn/render.ts";
import { Cells, esc, type Rect } from "./drawio.ts";
import { isActor, isExternal } from "./lint.ts";
import type { C4Element, C4Model, C4Relation } from "./model.ts";
import { PALETTE } from "./style.ts";

const FILL = {
  system: "#1168bd",
  container: "#438dd5",
  component: "#85bbf0",
  artifact: "#c7e0f8",
  external: "#8a8a8a",
};
const TINTS: readonly [string, string][] = [
  ["#e8f1fb", "#7aa7d9"],
  ["#eaf6ec", "#7fbf8a"],
  ["#fdf1e3", "#e0a35c"],
  ["#f4ecfa", "#b08fd1"],
  ["#e6f6f5", "#5fb3ad"],
  ["#fbeaea", "#d98a8a"],
];
const GREY_LINE = "#7a7a7a";
/** A view with more relations is split by question (Brown gives no limit; this one is ours). */
const RELATION_LIMIT = 15;
const W = 200;
const H = 84;
const CH = 5.9;

/** A relation as a view draws it: lifted to the elements the view shows. */
interface Edge {
  readonly from: string;
  readonly to: string;
  readonly title: string;
}

interface Drawn {
  readonly name: string;
  readonly title: string;
  readonly boundary: string | null;
  readonly box: ReadonlyMap<string, Rect>;
  readonly doc: string;
}

/** Who uses a shared element: three names, or a count. */
const names = (xs: string[]): string => (xs.length > 3 ? `${xs.length} plugins` : xs.join(", "));
/** An id is the element or inside it. */
const within = (x: string, id: string): boolean => x === id || x.startsWith(`${id}.`);

const wrap = (s: string, n: number): string[] =>
  s.split(" ").reduce<string[]>((ls, w) => {
    const l = ls.at(-1);
    if (l !== undefined && `${l} ${w}`.length <= n) {
      ls[ls.length - 1] = `${l} ${w}`;
    } else {
      ls.push(w);
    }
    return ls;
  }, []);

class Graph4 {
  readonly byId: ReadonlyMap<string, C4Element>;
  readonly groups: readonly string[];

  constructor(
    readonly els: readonly C4Element[],
    readonly rels: readonly C4Relation[],
  ) {
    this.byId = new Map(els.map((e) => [e.id, e]));
    this.groups = [...new Set(els.map((e) => e.metadata.group).filter((g) => g !== undefined))];
  }

  title(id: string): string {
    return this.byId.get(id)?.title ?? id;
  }

  external(e: C4Element): boolean {
    return isExternal(e, this.byId);
  }

  base(e: C4Element): string {
    if (isActor(e)) {
      return PALETTE[e.metadata.colour ?? ""] ?? GREY_LINE;
    }
    if (this.external(e)) {
      return FILL.external;
    }
    return e.tags.includes("artifact")
      ? FILL.artifact
      : e.kind === "person"
        ? GREY_LINE
        : FILL[e.kind];
  }

  ink(e: C4Element): string {
    return e.kind === "component" && !this.external(e) ? "#0b2540" : "#ffffff";
  }

  kindLabel(e: C4Element): string {
    const kind = this.external(e)
      ? "external system"
      : e.tags.includes("agent")
        ? "agent"
        : e.tags.includes("artifact")
          ? "artifact"
          : e.kind;
    return e.technology === "" ? kind : `${kind}: ${e.technology}`;
  }

  tier(e: C4Element): number {
    return isActor(e) ? 0 : this.external(e) ? 2 : 1;
  }

  lineColour(from: string): string {
    const s = this.byId.get(from);
    return s !== undefined && isActor(s)
      ? (PALETTE[s.metadata.colour ?? ""] ?? GREY_LINE)
      : GREY_LINE;
  }

  /** Each relation lifted to the elements a view shows; one inside a shown element is dropped. */
  lifted(vis: ReadonlySet<string>): Edge[] {
    const lift = (id: string): string | null => {
      for (let x: string | null = id; x !== null; x = this.byId.get(x)?.parent ?? null) {
        if (vis.has(x)) {
          return x;
        }
      }
      return null;
    };
    const m = new Map<
      string,
      { from: string; to: string; titles: string[]; techs: string[]; count: number }
    >();
    for (const r of this.rels) {
      const a = lift(r.from);
      const b = lift(r.to);
      if (a === null || b === null || a === b) {
        continue;
      }
      const k = `${a}->${b}`;
      const x = m.get(k) ?? { from: a, to: b, titles: [], techs: [], count: 0 };
      m.set(k, x);
      x.count += 1;
      if (!x.titles.includes(r.title)) {
        x.titles.push(r.title);
      }
      if (!x.techs.includes(r.technology)) {
        x.techs.push(r.technology);
      }
    }
    // a label ends with its technology in brackets, as the C4 checklist asks of every relation
    return [...m.values()].map((x) => ({
      from: x.from,
      to: x.to,
      title: `${x.count > 2 ? `${x.count} relations, zoom in to see them` : x.titles.join("; ")} [${x.techs.join(", ")}]`,
    }));
  }
}

interface Label {
  readonly lines: string[];
  readonly width: number;
  readonly height: number;
}

const labelOf = (t: string): Label => {
  const lines = wrap(t, 24);
  return {
    lines,
    width: Math.max(...lines.map((l) => l.length)) * CH + 6,
    height: lines.length * 12 + 2,
  };
};

type Seg = [{ x: number; y: number }, { x: number; y: number }];

function segsOf(ed: ElkExtendedEdge): Seg[] {
  return (ed.sections ?? []).flatMap((s) => {
    const q = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
    return q.slice(1).map((v, i): Seg => [q[i] ?? v, v]);
  });
}

function distTo([u, v]: Seg, x: number, y: number): number {
  const dx = v.x - u.x;
  const dy = v.y - u.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - u.x) * dx + (y - u.y) * dy) / len));
  return Math.hypot(x - (u.x + t * dx), y - (u.y + t * dy));
}

const overlapArea = (p: Rect, q: Rect): number =>
  Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) *
  Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));

type Spot = Rect & { end: boolean };
const ALONG = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];

/** The spots beside one segment a label may take, in the order they are tried. */
function spots(l: Label, [u, v]: Seg): Spot[] {
  const size = { w: l.width, h: l.height };
  return ALONG.flatMap((t) =>
    [true, false].map((side) =>
      u.x === v.x
        ? {
            x: side ? u.x + 5 : u.x - l.width - 5,
            y: u.y + (v.y - u.y) * t - l.height / 2,
            ...size,
            end: !side,
          }
        : {
            x: u.x + (v.x - u.x) * t - l.width / 2,
            y: side ? u.y - l.height - 3 : u.y + 4,
            ...size,
            end: false,
          },
    ),
  );
}

/** Where a label sits beside a segment of its own line: longest segment first, both sides, the
 * first spot that covers nothing and is nearer its own line than any other, else the least harm. */
function placeLabel(l: Label, own: Seg[], others: Seg[], placed: Rect[]): Spot {
  const segs = own.toSorted(
    (a, b) =>
      Math.hypot(b[1].x - b[0].x, b[1].y - b[0].y) - Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y),
  );
  const harm = (p: Rect): number => {
    const covered = placed.reduce((acc, q) => acc + overlapArea(p, q), 0);
    const cx = p.x + l.width / 2;
    const cy = p.y + l.height / 2;
    const mine = Math.min(...own.map((s) => distTo(s, cx, cy)));
    // a label nearer another line than its own reads as that line's label
    return covered + (others.some((s) => distTo(s, cx, cy) < mine) ? 1e6 : 0);
  };
  let best: Spot | null = null;
  let least = Infinity;
  for (const cand of segs.flatMap((seg) => spots(l, seg))) {
    const o = harm(cand);
    if (o === 0) {
      return cand;
    }
    if (o < least) {
      least = o;
      best = cand;
    }
  }
  return best ?? { x: 0, y: 0, w: l.width, h: l.height, end: false };
}

function rectSvg(b: Rect, fill: string, stroke: string, dash: boolean, rx: number): string {
  return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"${dash ? ' stroke-dasharray="7 4"' : ""}/>`;
}

function legendKeys(
  g: Graph4,
  shown: readonly C4Element[],
  lines: readonly Edge[],
  groups: number,
  shared: number,
): [string, string][] {
  const keys: [string, string][] = shown
    .filter(isActor)
    .map((e) => [g.base(e), `${e.title}: its box and the lines it starts`]);
  const inside = shown.find((e) => !isActor(e) && !g.external(e) && e.kind !== "component");
  if (inside !== undefined) {
    keys.push([FILL[inside.kind === "person" ? "system" : inside.kind], "inside the marketplace"]);
  }
  if (shown.some((e) => e.kind === "component" && !e.tags.includes("artifact"))) {
    keys.push([FILL.component, "component: code inside the container"]);
  }
  if (shown.some((e) => e.tags.includes("artifact"))) {
    keys.push([FILL.artifact, "artifact: a skill or agent file a session loads"]);
  }
  if (shown.some((e) => g.external(e))) {
    keys.push([FILL.external, "external system"]);
  }
  if (lines.some((r) => g.lineColour(r.from) === GREY_LINE)) {
    keys.push(["dash", "a relation between parts of the system"]);
  }
  if (groups > 0) {
    keys.push(["tint", "a group: one area of the system"]);
  }
  if (shared > 0) {
    keys.push(["note", "italic note: who uses it, drawn without lines"]);
  }
  if (shown.some((e) => g.els.some((c) => c.parent === e.id))) {
    keys.push(["zoom", "dashed outline: click to open its own view"]);
  }
  return keys;
}

function legendSvg(keys: [string, string][], ly: number): { svg: string; height: number } {
  const lh = 16 * keys.length + 26;
  const out = [
    `<rect x="0" y="${ly}" width="330" height="${lh}" rx="6" fill="#fafafa" stroke="#cccccc"/>`,
    `<text x="10" y="${ly + 16}" font-size="11" font-weight="bold" fill="#222222">Legend</text>`,
  ];
  keys.forEach(([c, t], i) => {
    const y = ly + 30 + i * 16;
    const mark =
      c === "dash"
        ? `<line x1="10" y1="${y - 4}" x2="30" y2="${y - 4}" stroke="${GREY_LINE}" stroke-width="1.4" stroke-dasharray="5 3"/>`
        : c === "tint"
          ? `<rect x="10" y="${y - 10}" width="20" height="11" rx="3" fill="${TINTS[0]?.[0] ?? ""}" stroke="${TINTS[0]?.[1] ?? ""}"/>`
          : c === "zoom"
            ? `<rect x="10" y="${y - 10}" width="20" height="11" rx="3" fill="none" stroke="#111111" stroke-width="1.5" stroke-dasharray="3 2"/>`
            : c === "note"
              ? `<text x="12" y="${y}" font-size="10" font-style="italic" fill="#333333">abc</text>`
              : `<rect x="10" y="${y - 10}" width="20" height="11" rx="3" fill="${c}"/>`;
    out.push(mark, `<text x="38" y="${y}" font-size="10" fill="#333333">${esc(t)}</text>`);
  });
  return { svg: out.join(""), height: lh };
}

const LAYOUT = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.json.edgeCoords": "ROOT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.partitioning.activate": "true",
  "elk.layered.spacing.nodeNodeBetweenLayers": "70",
  "elk.spacing.nodeNode": "40",
  "elk.spacing.edgeEdge": "16",
  "elk.spacing.edgeNode": "24",
  "elk.layered.spacing.edgeNodeBetweenLayers": "24",
  "elk.edgeLabels.inline": "true",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
};

async function drawView(
  g: Graph4,
  name: string,
  title: string,
  boundary: C4Element | null,
  shown: readonly C4Element[],
  edges: readonly Edge[],
): Promise<Drawn> {
  const inside = boundary === null ? [] : shown.filter((e) => e.parent === boundary.id);
  const outside = shown.filter((e) => !inside.includes(e));
  const shared = inside.filter((e) => e.tags.includes("shared"));
  const groups = [...new Set(inside.map((e) => e.metadata.group).filter((x) => x !== undefined))];
  const tint = (grp: string): [string, string] =>
    TINTS[g.groups.indexOf(grp) % TINTS.length] ?? ["#ffffff", "#cccccc"];
  const usedBy = (e: C4Element): string[] => [
    ...new Set(
      g.rels
        .filter((r) => r.to === e.id || r.to.startsWith(`${e.id}.`))
        .map((r) => g.title(r.from)),
    ),
  ];
  // an external system whose users inside are not drawn in this view names them in a note
  const hiddenUsers = (e: C4Element): string[] =>
    g.external(e)
      ? g.rels
          .filter(
            (r) =>
              r.to === e.id &&
              inside.some((i) => i.id === r.from) &&
              !edges.some((d) => d.from === r.from && d.to === r.to),
          )
          .map((r) => g.title(r.from))
      : [];
  const leaf = (e: C4Element): ElkNode => ({
    id: e.id,
    width: W,
    height: H + (shared.includes(e) || hiddenUsers(e).length > 0 ? 14 : 0),
  });
  const lines = edges.filter((r) => !shared.some((s) => s.id === r.from || s.id === r.to));
  const byEdge = new Map(lines.map((r, k) => [`e${k}`, r]));
  const graph: ElkNode = {
    id: "root",
    layoutOptions: LAYOUT,
    children: [
      ...outside.map((e) => ({
        ...leaf(e),
        layoutOptions: { "elk.partitioning.partition": String(g.tier(e)) },
      })),
      ...(boundary === null
        ? []
        : [
            {
              id: boundary.id,
              layoutOptions: {
                "elk.partitioning.partition": "1",
                "elk.padding": "[top=14,left=14,bottom=36,right=14]",
              },
              children: [
                ...groups.map((grp, k) => ({
                  id: `group-${k}`,
                  layoutOptions: { "elk.padding": "[top=28,left=10,bottom=10,right=10]" },
                  children: inside.filter((e) => e.metadata.group === grp).map(leaf),
                })),
                ...inside.filter((e) => e.metadata.group === undefined).map(leaf),
              ],
            },
          ]),
    ],
    edges: [
      ...lines.map((r, k) => {
        const l = labelOf(r.title);
        return {
          id: `e${k}`,
          sources: [r.from],
          targets: [r.to],
          labels: [{ text: r.title, width: l.width, height: l.height }],
        };
      }),
      // an external system sits beside the containers that use it, even where those relations are
      // not drawn: they enter the layout as hints and are never drawn
      ...g.rels
        .filter(
          (r) =>
            outside.some((e) => e.id === r.to && g.external(e)) &&
            inside.some((e) => e.id === r.from) &&
            !lines.some((x) => x.from === r.from && x.to === r.to),
        )
        .map((r, k) => ({ id: `hint${k}`, sources: [r.from], targets: [r.to] })),
    ],
  };
  const out = await new ELK().layout(graph);
  const drawnEdges = (out.edges ?? []).filter((e) => byEdge.has(e.id));
  const abs = new Map<string, Rect>();
  const walk = (n: ElkNode, ox: number, oy: number): void => {
    const r = { x: ox + (n.x ?? 0), y: oy + (n.y ?? 0), w: n.width ?? 0, h: n.height ?? 0 };
    abs.set(n.id, r);
    for (const c of n.children ?? []) {
      walk(c, r.x, r.y);
    }
  };
  walk(out, 0, 0);
  const at = (id: string): Rect => abs.get(id) ?? { x: 0, y: 0, w: 0, h: 0 };

  const svg: string[] = [];
  const cells = new Cells();
  // titles are drawn after the lines, each on its own background, so a line passes under a title
  const titles: string[] = [];
  const placed: Rect[] = shown.map((e) => at(e.id));
  if (boundary !== null) {
    const b = at(boundary.id);
    svg.push(rectSvg(b, "none", "#555555", true, 12));
    titles.push(
      `<rect x="${b.x + 8}" y="${b.y + b.h - 27}" width="${boundary.title.length * 8 + 112}" height="20" fill="#ffffff"/>`,
      `<text x="${b.x + 12}" y="${b.y + b.h - 12}" font-size="13" font-weight="bold" fill="#222222">${esc(boundary.title)} <tspan font-size="9" font-weight="normal">[${boundary.kind === "system" ? "software system" : "container"}]</tspan></text>`,
    );
    cells.boundary(boundary, b);
    placed.push({ x: b.x, y: b.y + b.h - 28, w: boundary.title.length * 8 + 120, h: 24 });
    groups.forEach((grp, k) => {
      const gb = at(`group-${k}`);
      const [fill, stroke] = tint(grp);
      svg.push(rectSvg(gb, fill, stroke, false, 10));
      titles.push(
        `<rect x="${gb.x + 6}" y="${gb.y + 5}" width="${grp.length * 6.2 + 10}" height="17" rx="3" fill="${fill}"/>`,
        `<text x="${gb.x + 10}" y="${gb.y + 18}" font-size="11" fill="#333333">${esc(grp)}</text>`,
      );
      cells.group(grp, gb, fill, stroke);
      placed.push({ x: gb.x, y: gb.y, w: grp.length * 6.5 + 20, h: 24 });
    });
  }
  for (const e of shown) {
    const b = at(e.id);
    const hidden = hiddenUsers(e);
    const note = shared.includes(e)
      ? [`used by ${names(usedBy(e))}`]
      : hidden.length > 0
        ? [`used by ${hidden.join(", ")}`]
        : [];
    const body = [...wrap(e.summary, 32), ...note];
    const base = g.base(e);
    svg.push(
      rectSvg(b, base, base, false, e.kind === "person" ? 22 : 10),
      `<text x="${b.x + b.w / 2}" y="${b.y + 18}" text-anchor="middle" fill="${g.ink(e)}"><tspan font-size="12.5" font-weight="bold">${esc(e.title)}</tspan><tspan x="${b.x + b.w / 2}" dy="12" font-size="8.5">[${esc(g.kindLabel(e))}]</tspan>${body.map((l, i) => `<tspan x="${b.x + b.w / 2}" dy="12" font-size="10"${i >= body.length - note.length ? ' font-style="italic"' : ""}>${esc(l)}</tspan>`).join("")}</text>`,
    );
    cells.element(e, b, { fill: base, stroke: base, ink: g.ink(e) });
  }
  const allSegs = drawnEdges.map(segsOf);
  drawnEdges.forEach((ed) => {
    const rel = byEdge.get(ed.id);
    if (rel === undefined) {
      return;
    }
    const c = g.lineColour(rel.from);
    const from = g.byId.get(rel.from);
    const dash = from === undefined || !isActor(from);
    for (const [u, v] of segsOf(ed)) {
      placed.push({
        x: Math.min(u.x, v.x) - 2,
        y: Math.min(u.y, v.y) - 2,
        w: Math.abs(v.x - u.x) + 4,
        h: Math.abs(v.y - u.y) + 4,
      });
    }
    for (const s of ed.sections ?? []) {
      const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
      svg.push(
        `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2.4"${dash ? ' stroke-dasharray="5 3"' : ""} marker-end="url(#a${c.slice(1)})"/>`,
      );
      cells.relation(rel.from, rel.to, rel.title, s.bendPoints ?? [], c, dash);
    }
  });
  svg.push(...titles);
  drawnEdges.forEach((ed, k) => {
    const rel = byEdge.get(ed.id);
    if (rel === undefined) {
      return;
    }
    const l = labelOf(rel.title);
    const own = allSegs[k] ?? [];
    const others = allSegs.filter((_, i) => i !== k).flat();
    const p = placeLabel(l, own, others, placed);
    placed.push(p);
    const c = g.lineColour(rel.from);
    const tx = p.end ? p.x + l.width - 2 : p.x + 3;
    svg.push(
      `<rect x="${p.x}" y="${p.y - 1}" width="${l.width}" height="${l.height}" rx="2" fill="#ffffff"/>`,
      `<text x="${tx}" y="${p.y + 9}" font-size="10" fill="${c}"${p.end ? ' text-anchor="end"' : ""}>${l.lines.map((t, i) => `<tspan x="${tx}" dy="${i === 0 ? 0 : 12}">${esc(t)}</tspan>`).join("")}</text>`,
    );
  });
  const key = legendSvg(
    legendKeys(g, shown, lines, groups.length, shared.length),
    (out.height ?? 0) + 16,
  );
  svg.push(key.svg);
  const colours = [...new Set([...Object.values(PALETTE), GREY_LINE])];
  const defs = colours
    .map(
      (c) =>
        `<marker id="a${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker>`,
    )
    .join("");
  const wt = Math.max(out.width ?? 0, 330) + 20;
  const ht = (out.height ?? 0) + key.height + 66;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" content="${esc(cells.file(name))}" width="${wt}" height="${ht}" viewBox="-10 -40 ${wt} ${ht}" font-family="Helvetica, Arial, sans-serif"><defs>${defs}</defs><rect x="-10" y="-40" width="${wt}" height="${ht}" fill="#ffffff"/><text x="0" y="-16" font-size="15" font-weight="bold" fill="#111111">${esc(title)}</text>${svg.join("")}</svg>`;
  return {
    name,
    title,
    boundary: boundary?.id ?? null,
    box: new Map(shown.map((e) => [e.id, at(e.id)])),
    doc,
  };
}

/** The views of one element zoomed into: its children and what they touch outside; a view over the
 * relation limit is split into who uses what and what depends on what. */
async function zoom(g: Graph4, b: C4Element, level: string, title: string): Promise<Drawn[]> {
  const kids = g.els.filter((c) => c.parent === b.id);
  const anc = new Set<string>();
  for (let x: string | null = b.id; x !== null; x = g.byId.get(x)?.parent ?? null) {
    anc.add(x);
  }
  const outer = (y: string): string | null => {
    let best: string | null = null;
    for (let x: string | null = y; x !== null; x = g.byId.get(x)?.parent ?? null) {
      const parent = g.byId.get(x)?.parent ?? null;
      if (!anc.has(x) && (parent === null || anc.has(parent))) {
        best = x;
      }
    }
    return best;
  };
  const near = new Set<C4Element>();
  for (const r of g.rels) {
    for (const [x, y] of [
      [r.from, r.to],
      [r.to, r.from],
    ] as const) {
      if (!kids.some((k) => within(x, k.id)) || within(y, b.id)) {
        continue;
      }
      const t = outer(y);
      const e = t === null ? undefined : g.byId.get(t);
      if (e !== undefined) {
        near.add(e);
      }
    }
  }
  const shown = [...kids, ...near];
  // a zoomed view draws only relations that touch what it zooms into, never two outsiders
  const edges = g
    .lifted(new Set(shown.map((e) => e.id)))
    .filter((r) => kids.some((k) => k.id === r.from || k.id === r.to));
  if (edges.length <= RELATION_LIMIT) {
    return [await drawView(g, level, `${title} of ${b.title}`, b, shown, edges)];
  }
  const fromOutside = (r: Edge): boolean => !kids.some((k) => k.id === r.from);
  const uses = edges.filter(fromOutside);
  const deps = edges.filter((r) => !fromOutside(r));
  const touched = (es: Edge[]): C4Element[] =>
    shown.filter((e) => es.some((r) => r.from === e.id || r.to === e.id));
  const withKids = (es: Edge[]): C4Element[] =>
    shown.filter((e) => kids.includes(e) || es.some((r) => r.from === e.id || r.to === e.id));
  // the uses half shows only the containers an actor uses; every container is in the depends half
  return [
    await drawView(
      g,
      `${level}-uses`,
      `${title} of ${b.title}, 1 of 2: who uses what`,
      b,
      touched(uses),
      uses,
    ),
    await drawView(
      g,
      `${level}-depends`,
      `${title} of ${b.title}, 2 of 2: what depends on what`,
      b,
      withKids(deps),
      deps,
    ),
  ];
}

/** Zoom links: an element with a view of its own opens it, a zoomed view links back to the view
 * that shows its boundary, and the two halves of a split view link to each other. */
function withZoomLinks(
  v: Drawn,
  views: readonly Drawn[],
  fileOf: (name: string) => string,
  g: Graph4,
): string {
  const links: string[] = [];
  for (const [id, b] of v.box) {
    const inner = views.find((w) => w.boundary === id);
    if (inner !== undefined) {
      links.push(
        `<a href="${esc(fileOf(inner.name))}"><title>Zoom into ${esc(g.title(id))}</title><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="#ffffff" fill-opacity="0" stroke="#111111" stroke-width="2.5" stroke-dasharray="6 4" style="cursor: pointer"/></a>`,
      );
    }
  }
  const up =
    v.boundary === null
      ? undefined
      : views.find((w) => w !== v && w.boundary !== v.boundary && w.box.has(v.boundary ?? ""));
  const twin =
    v.boundary === null ? undefined : views.find((w) => w !== v && w.boundary === v.boundary);
  const nav = [
    up === undefined
      ? ""
      : `<a href="${esc(fileOf(up.name))}"><text x="0" y="-44" font-size="13" fill="#08427b" text-decoration="underline">&#8593; Zoom out: ${esc(up.title)}</text></a>`,
    twin === undefined
      ? ""
      : `<a href="${esc(fileOf(twin.name))}"><text x="${up === undefined ? 0 : 520}" y="-44" font-size="13" fill="#08427b" text-decoration="underline">&#8594; ${esc(twin.title.split(", ").pop() ?? "")}</text></a>`,
  ].filter((x) => x !== "");
  let doc = v.doc;
  if (nav.length > 0) {
    doc = doc
      .replace(
        /viewBox="-10 -40 ([\d.]+) ([\d.]+)"/,
        (_, w: string, h: string) => `viewBox="-10 -64 ${w} ${Number(h) + 24}"`,
      )
      .replace(
        / height="([\d.]+)" viewBox/,
        (_, h: string) => ` height="${Number(h) + 24}" viewBox`,
      )
      .replace(
        /<rect x="-10" y="-40" width="([\d.]+)" height="([\d.]+)" fill="#ffffff"\/>/,
        (_, w: string, h: string) =>
          `<rect x="-10" y="-64" width="${w}" height="${Number(h) + 24}" fill="#ffffff"/>`,
      );
  }
  return `${doc.replace(/<\/svg>$/, `<g class="zoom-links">${links.join("")}${nav.join("")}</g></svg>`)}\n`;
}

const viewName = (project: string, view: string): string => `${project}.${view}.drawio.svg`;

/** Every view of the graph: the context, the containers of each internal system, the components of
 * each container that has any. */
export async function renderC4(m: C4Model, project: string): Promise<Picture[]> {
  const g = new Graph4(m.elements, m.relations);
  const top = g.els.filter((e) => e.parent === null);
  const views: Drawn[] = [
    await drawView(
      g,
      "context",
      "C4 level 1, context",
      null,
      top,
      g.lifted(new Set(top.map((e) => e.id))),
    ),
  ];
  for (const s of g.els.filter(
    (e) => e.kind === "system" && !g.external(e) && g.els.some((c) => c.parent === e.id),
  )) {
    views.push(...(await zoom(g, s, "containers", "C4 level 2, containers")));
  }
  for (const c of g.els.filter(
    (e) => e.kind === "container" && g.els.some((k) => k.parent === e.id),
  )) {
    views.push(
      ...(await zoom(
        g,
        c,
        `components-${c.id.split(".").pop() ?? c.id}`,
        "C4 level 3, components",
      )),
    );
  }
  const fileOf = (name: string): string => viewName(project, name);
  return views.map((v) => ({ name: fileOf(v.name), svg: withZoomLinks(v, views, fileOf, g) }));
}
