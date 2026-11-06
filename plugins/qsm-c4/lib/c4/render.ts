// render for C4: one view per level, generated from the graph, laid out by ELK layered in tiers
// (actors, the system in scope with its groups, external systems), drawn as an SVG that carries
// the view's draw.io diagram, with links that zoom in and out between the views.
import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import { escapeHtml as esc } from "../../../../lib/html.ts";
import { PALETTE } from "../../../../lib/palette.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import type { Picture } from "../../../../lib/model-graph.ts";
import { Cells, type Rect } from "./drawio.ts";
import { isActor, isExternal } from "./lint.ts";
import type { C4Element, C4Model, C4Relation } from "./model.ts";
import { hasTag, TAGS } from "./style.ts";

const FILL = {
  system: "#1168bd",
  container: "#438dd5",
  component: "#85bbf0",
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

/** A view as drawn: its parts, so the `<svg>` header is written once, when the links are known. */
interface Drawn {
  readonly name: string;
  readonly title: string;
  readonly boundary: string | null;
  readonly box: ReadonlyMap<string, Rect>;
  readonly width: number;
  readonly height: number;
  /** the view's draw.io file */
  readonly content: string;
  readonly defs: string;
  readonly body: string;
  /** what the layout paints touching something else, by `layoutDefects` */
  readonly defects: readonly string[];
}

const kindFill = (kind: C4Element["kind"]): string => (kind === "person" ? GREY_LINE : FILL[kind]);

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

  /** An actor's colour, none for an element that is not one. */
  actorColour(id: string): string | undefined {
    const e = this.byId.get(id);
    return e !== undefined && isActor(e)
      ? (PALETTE[e.metadata.colour ?? ""] ?? GREY_LINE)
      : undefined;
  }

  /** The top-level element the id sits in. */
  rootTitle(id: string): string {
    let at = this.byId.get(id);
    for (let up = at?.parent; up !== null && up !== undefined; up = at?.parent) {
      at = this.byId.get(up);
    }
    return at?.title ?? id;
  }

  base(e: C4Element): string {
    return (
      this.actorColour(e.id) ??
      (this.external(e)
        ? TAGS.external.fill
        : hasTag(e, "artifact")
          ? TAGS.artifact.fill
          : kindFill(e.kind))
    );
  }

  ink(e: C4Element): string {
    return e.kind === "component" && !this.external(e) ? "#0b2540" : "#ffffff";
  }

  kindLabel(e: C4Element): string {
    const kind = this.external(e)
      ? TAGS.external.label
      : hasTag(e, "agent")
        ? TAGS.agent.label
        : hasTag(e, "artifact")
          ? TAGS.artifact.label
          : e.kind;
    return e.technology === "" ? kind : `${kind}: ${e.technology}`;
  }

  tier(e: C4Element): number {
    return isActor(e) ? 0 : this.external(e) ? 2 : 1;
  }

  lineColour(from: string): string {
    return this.actorColour(from) ?? GREY_LINE;
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

const overlapArea = (p: Rect, q: Rect): number =>
  Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) *
  Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));

/** The smallest gap two painted bodies keep: the spacing scale of the layout. */
const GAP = 16;

const crosses = ([u, v]: Seg, r: Rect): boolean =>
  Math.max(u.x, v.x) >= r.x &&
  Math.min(u.x, v.x) <= r.x + r.w &&
  Math.max(u.y, v.y) >= r.y &&
  Math.min(u.y, v.y) <= r.y + r.h;

/** The four sides of a box: the lines a boundary or a group draws. */
function sidesOf(r: Rect): Seg[] {
  const [a, b, c, d] = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
  return [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ];
}

/** Whether a box comes within the gap of a line, or crosses it. */
const nearLine = (box: Rect, s: Seg): boolean =>
  crosses(s, { x: box.x - GAP, y: box.y - GAP, w: box.w + 2 * GAP, h: box.h + 2 * GAP });

/** Two parallel segments side by side closer than the gap: both vertical or both horizontal,
 * overlapping along their run; how far apart they are and how long they run so. */
function sideBySide([a, b]: Seg, [c, d]: Seg): { apart: number; run: number } | null {
  const vertical = (p: Seg[0], q: Seg[0]): boolean => p.x === q.x;
  const [along, across] =
    vertical(a, b) && vertical(c, d) ? (["y", "x"] as const) : (["x", "y"] as const);
  const apart = Math.abs(a[across] - c[across]);
  if (a[across] !== b[across] || c[across] !== d[across] || apart >= GAP) {
    return null;
  }
  const lo = Math.max(Math.min(a[along], b[along]), Math.min(c[along], d[along]));
  const hi = Math.min(Math.max(a[along], b[along]), Math.max(c[along], d[along]));
  return hi > lo ? { apart, run: hi - lo } : null;
}

interface DrawnLine {
  readonly title: string;
  readonly segs: Seg[];
  readonly label: Rect | undefined;
}

/** Whether a line's own label sits on or within the scale of an outline of the boundary or a
 * group, where its background cuts the outline. */
const labelOnOutline = (e: DrawnLine, outlines: readonly Seg[]): boolean => {
  const own = e.label;
  return own !== undefined && outlines.some((s) => nearLine(own, s));
};

/** The gap between a box and an axis-aligned segment, 0 where they touch. */
const gapTo = (r: Rect, [u, v]: Seg): number =>
  Math.hypot(
    Math.max(0, Math.min(u.x, v.x) - (r.x + r.w), r.x - Math.max(u.x, v.x)),
    Math.max(0, Math.min(u.y, v.y) - (r.y + r.h), r.y - Math.max(u.y, v.y)),
  );

/** Why a line's label does not read as that line's: farther than the scale from it, or nearer
 * another line than its own; nothing when it reads right. */
function labelStrays(e: DrawnLine, edges: readonly DrawnLine[]): string | undefined {
  const own = e.label;
  if (own === undefined) {
    return undefined;
  }
  const mine = Math.min(...e.segs.map((s) => gapTo(own, s)));
  const other = Math.min(
    ...edges.filter((f) => f !== e).flatMap((f) => f.segs.map((s) => gapTo(own, s))),
  );
  // ELK sets a label at the scale from its line; a pixel more is rounding, more than that a stray
  if (mine > GAP + 1) {
    return `${Math.round(mine)} px from its own line, farther than ${GAP} px`;
  }
  return other < mine
    ? `nearer another line (${Math.round(other)} px) than its own (${Math.round(mine)} px)`
    : undefined;
}
/** Whether a line's own label covers a box or another line's label. */
const labelCovers = (
  e: DrawnLine,
  edges: readonly DrawnLine[],
  bodies: readonly Rect[],
): boolean => {
  const own = e.label;
  const others = edges.flatMap((f) => (f === e || f.label === undefined ? [] : [f.label]));
  return own !== undefined && [...bodies, ...others].some((b) => overlapArea(own, b) > 0);
};

/** What a line's own label touches or how it fails to read as that line's. */
function labelDefects(
  e: DrawnLine,
  edges: readonly DrawnLine[],
  outlines: readonly Seg[],
  bodies: readonly Rect[],
): string[] {
  const strayed = labelStrays(e, edges);
  return [
    ...(labelOnOutline(e, outlines)
      ? [`the label of "${e.title}" sits within ${GAP} px of a boundary's or a group's line`]
      : []),
    ...(labelCovers(e, edges, bodies)
      ? [`the label of "${e.title}" covers a box or another label`]
      : []),
    ...(strayed === undefined ? [] : [`the label of "${e.title}" sits ${strayed}`]),
  ];
}

/** Where a view breaks the rule that nothing painted touches anything else: a line through the
 * label of the view's boundary, two lines side by side closer than the spacing scale, a line
 * running beside an outline of the boundary or a group, or a line's label that touches an outline,
 * a box or another label, or does not read as its own line's. */
function layoutDefects(
  label: Rect | null,
  edges: readonly DrawnLine[],
  outlines: readonly Seg[],
  bodies: readonly Rect[],
): string[] {
  const out: string[] = [];
  for (const [i, e] of edges.entries()) {
    if (e.segs.some((s) => outlines.some((o) => sideBySide(s, o) !== null))) {
      out.push(
        `the line "${e.title}" runs beside a boundary's or a group's line, closer than ${GAP} px`,
      );
    }
    out.push(...labelDefects(e, edges, outlines, bodies));
    if (label !== null && e.segs.some((s) => crosses(s, label))) {
      out.push(`the line "${e.title}" runs through the boundary's label`);
    }
    for (const f of edges.slice(i + 1)) {
      const near = e.segs
        .flatMap((s) => f.segs.map((t) => sideBySide(s, t)))
        .find((x) => x !== null);
      if (near !== undefined && near !== null) {
        out.push(
          `the lines "${e.title}" and "${f.title}" run ${Math.round(near.run)} px side by side ${Math.round(near.apart)} px apart, closer than ${GAP} px`,
        );
      }
    }
  }
  return out;
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
  const keys: [string, string][] = shown.flatMap((e) => {
    const colour = g.actorColour(e.id);
    return colour === undefined ? [] : [[colour, `${e.title}: its box and the lines it starts`]];
  });
  const inside = shown.find((e) => !isActor(e) && !g.external(e) && e.kind !== "component");
  if (inside !== undefined) {
    keys.push([kindFill(inside.kind), `inside ${g.rootTitle(inside.id)}`]);
  }
  if (shown.some((e) => e.kind === "component" && !hasTag(e, "artifact"))) {
    keys.push([FILL.component, "component: code inside the container"]);
  }
  if (shown.some((e) => hasTag(e, "artifact"))) {
    keys.push([TAGS.artifact.fill, TAGS.artifact.legend]);
  }
  if (shown.some((e) => g.external(e))) {
    keys.push([TAGS.external.fill, TAGS.external.legend]);
  }
  if (lines.some((r) => g.actorColour(r.from) === undefined)) {
    keys.push(["dash", "a relation between parts of the system"]);
  }
  if (groups > 0) {
    keys.push(["tint", "a group: one area of the system"]);
  }
  if (shared > 0) {
    keys.push(["note", TAGS.shared.legend]);
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

/** The size of a boundary's label: its title and its kind in brackets, on its own background. */
const LABEL_SIZE = (title: string): { width: number; height: number } => ({
  width: title.length * 8 + 112,
  height: 20,
});

/** The boundary's label where ELK placed it, inside the boundary at `b`, or nothing. */
function labelAt(out: ElkNode, id: string, b: Rect): Rect | null {
  const l = (out.children ?? []).find((n) => n.id === id)?.labels?.[0];
  return l === undefined
    ? null
    : { x: b.x + (l.x ?? 0), y: b.y + (l.y ?? 0), w: l.width ?? 0, h: l.height ?? 0 };
}

/** The gaps between lines, at the spacing scale; ELK reads them per graph, so every compound node
 * carries them too, or the lines inside it keep ELK's 10 px defaults. */
const SPACING = {
  "elk.spacing.edgeEdge": String(GAP),
  "elk.spacing.edgeNode": "24",
  "elk.layered.spacing.edgeNodeBetweenLayers": "24",
  "elk.layered.spacing.edgeEdgeBetweenLayers": String(GAP),
  "elk.spacing.portPort": String(GAP),
  "elk.spacing.edgeLabel": String(GAP),
  "elk.spacing.labelLabel": String(GAP),
  "elk.spacing.labelNode": String(GAP),
  "elk.edgeLabels.inline": "false",
  "elk.edgeLabels.placement": "CENTER",
  "elk.layered.edgeLabels.sideSelection": "SMART_DOWN",
};

const LAYOUT = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.json.edgeCoords": "ROOT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.partitioning.activate": "true",
  "elk.layered.spacing.nodeNodeBetweenLayers": "70",
  "elk.spacing.nodeNode": "40",
  ...SPACING,
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
};

/** Each relation's label where ELK placed it, on its own background; `boxes` records where each
 * went. */
function edgeLabels(
  g: Graph4,
  drawn: readonly ElkExtendedEdge[],
  byEdge: ReadonlyMap<string, Edge>,
  boxes: Map<string, Rect>,
): string[] {
  return drawn.flatMap((ed) => {
    const rel = byEdge.get(ed.id);
    if (rel === undefined) {
      return [];
    }
    const l = labelOf(rel.title);
    const at = ed.labels?.[0];
    const p: Rect = { x: at?.x ?? 0, y: at?.y ?? 0, w: l.width, h: l.height };
    boxes.set(ed.id, p);
    const c = g.lineColour(rel.from);
    // a label left of its line ends at the line's side, so the text sits next to its line
    const nearest = segsOf(ed).toSorted((s, t) => gapTo(p, s) - gapTo(p, t))[0];
    const end = nearest !== undefined && nearest[0].x === nearest[1].x && nearest[0].x >= p.x + p.w;
    const tx = end ? p.x + p.w - 3 : p.x + 3;
    return [
      `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="2" fill="#ffffff"/>`,
      `<text x="${tx}" y="${p.y + 10}" font-size="10" fill="${c}"${end ? ' text-anchor="end"' : ""}>${l.lines.map((t, i) => `<tspan x="${tx}" dy="${i === 0 ? 0 : 12}">${esc(t)}</tspan>`).join("")}</text>`,
    ];
  });
}

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
  const shared = inside.filter((e) => hasTag(e, "shared"));
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
  const hiddenUsers = new Map(
    shown.map((e): [string, string[]] => [
      e.id,
      g.external(e)
        ? g.rels
            .filter(
              (r) =>
                r.to === e.id &&
                inside.some((i) => i.id === r.from) &&
                !edges.some((d) => d.from === r.from && d.to === r.to),
            )
            .map((r) => g.title(r.from))
        : [],
    ]),
  );
  /** The italic line under an element that is drawn without some of its lines. */
  const noteOf = (e: C4Element): string[] => {
    const hidden = hiddenUsers.get(e.id) ?? [];
    if (shared.includes(e)) {
      return [`used by ${names(usedBy(e))}`];
    }
    return hidden.length > 0 ? [`used by ${hidden.join(", ")}`] : [];
  };
  const leaf = (e: C4Element): ElkNode => ({
    id: e.id,
    width: W,
    height: H + (noteOf(e).length > 0 ? 14 : 0),
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
              // the boundary's title is a label ELK places and keeps clear of the lines
              labels: [
                { id: `${boundary.id}-label`, text: boundary.title, ...LABEL_SIZE(boundary.title) },
              ],
              layoutOptions: {
                "elk.partitioning.partition": "1",
                ...SPACING,
                // two scale steps of room, so a line along the inside stays a scale step off the outline
                "elk.padding": "[top=32,left=32,bottom=14,right=32]",
                "elk.nodeLabels.placement": "[H_LEFT, V_BOTTOM, INSIDE]",
                "elk.nodeLabels.padding": "[top=8,left=8,bottom=8,right=8]",
                "elk.nodeSize.constraints": "[NODE_LABELS]",
              },
              children: [
                ...groups.map((grp, k) => ({
                  id: `group-${k}`,
                  layoutOptions: {
                    ...SPACING,
                    "elk.padding": "[top=28,left=32,bottom=32,right=32]",
                  },
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
          labels: [
            {
              text: r.title,
              width: l.width,
              height: l.height,
              layoutOptions: { "elk.edgeLabels.inline": "false" },
            },
          ],
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
  // what a line's label may not cover: the boxes, the boundary's label and the group titles
  const bodies: Rect[] = shown.map((e) => at(e.id));
  const label = boundary === null ? null : labelAt(out, boundary.id, at(boundary.id));
  if (boundary !== null && label !== null) {
    bodies.push(label);
    const b = at(boundary.id);
    svg.push(rectSvg(b, "none", "#555555", true, 12));
    titles.push(
      `<rect x="${label.x}" y="${label.y}" width="${label.w}" height="${label.h}" fill="#ffffff"/>`,
      `<text x="${label.x + 4}" y="${label.y + 15}" font-size="13" font-weight="bold" fill="#222222">${esc(boundary.title)} <tspan font-size="9" font-weight="normal">[${boundary.kind === "system" ? "software system" : "container"}]</tspan></text>`,
    );
    cells.boundary(boundary, b);
    groups.forEach((grp, k) => {
      const gb = at(`group-${k}`);
      const [fill, stroke] = tint(grp);
      svg.push(rectSvg(gb, fill, stroke, false, 10));
      titles.push(
        `<rect x="${gb.x + 6}" y="${gb.y + 5}" width="${grp.length * 6.2 + 10}" height="17" rx="3" fill="${fill}"/>`,
        `<text x="${gb.x + 10}" y="${gb.y + 18}" font-size="11" fill="#333333">${esc(grp)}</text>`,
      );
      cells.group(grp, gb, fill, stroke);
      bodies.push({ x: gb.x + 6, y: gb.y + 5, w: grp.length * 6.2 + 10, h: 17 });
    });
  }
  for (const e of shown) {
    const b = at(e.id);
    const note = noteOf(e);
    const body = [...wrap(e.summary, 32), ...note];
    const base = g.base(e);
    svg.push(
      rectSvg(b, base, base, false, e.kind === "person" ? 22 : 10),
      `<text x="${b.x + b.w / 2}" y="${b.y + 18}" text-anchor="middle" fill="${g.ink(e)}"><tspan font-size="12.5" font-weight="bold">${esc(e.title)}</tspan><tspan x="${b.x + b.w / 2}" dy="12" font-size="8.5">[${esc(g.kindLabel(e))}]</tspan>${body.map((l, i) => `<tspan x="${b.x + b.w / 2}" dy="12" font-size="10"${i >= body.length - note.length ? ' font-style="italic"' : ""}>${esc(l)}</tspan>`).join("")}</text>`,
    );
    cells.element(e, b, { fill: base, stroke: base, ink: g.ink(e) });
  }
  drawnEdges.forEach((ed) => {
    const rel = byEdge.get(ed.id);
    if (rel === undefined) {
      return;
    }
    const c = g.lineColour(rel.from);
    const dash = g.actorColour(rel.from) === undefined;
    for (const s of ed.sections ?? []) {
      const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
      svg.push(
        `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2.4"${dash ? ' stroke-dasharray="5 3"' : ""} marker-end="url(#a${c.slice(1)})"/>`,
      );
      cells.relation(rel.from, rel.to, rel.title, s.bendPoints ?? [], c, dash);
    }
  });
  // the outlines of the boundary and its groups, which no line or line's label may sit on
  const outlines = (boundary === null ? [] : [boundary.id, ...groups.map((_, k) => `group-${k}`)])
    .map(at)
    .flatMap(sidesOf);
  const boxes = new Map<string, Rect>();
  svg.push(...titles, ...edgeLabels(g, drawnEdges, byEdge, boxes));
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
  return {
    name,
    title,
    boundary: boundary?.id ?? null,
    box: new Map(shown.map((e) => [e.id, at(e.id)])),
    width: wt,
    height: ht,
    content: cells.file(name),
    defs,
    body: svg.join(""),
    defects: layoutDefects(
      label,
      drawnEdges.map((ed) => ({
        title: byEdge.get(ed.id)?.title ?? ed.id,
        segs: segsOf(ed),
        label: boxes.get(ed.id),
      })),
      outlines,
      bodies,
    ),
  };
}

/** The view's `<svg>`, its header written once for the room `lift` makes above the title, with
 * `extra` last inside it; the draw.io diagram rides in `content` only when it is wanted. */
function svgOf(v: Drawn, lift: number, extra: string, drawio: boolean): string {
  const top = -40 - lift;
  const height = v.height + lift;
  const content = drawio ? ` content="${esc(v.content)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${content} width="${v.width}" height="${height}" viewBox="-10 ${top} ${v.width} ${height}" font-family="Helvetica, Arial, sans-serif"><defs>${v.defs}</defs><rect x="-10" y="${top}" width="${v.width}" height="${height}" fill="#ffffff"/><text x="0" y="-16" font-size="15" font-weight="bold" fill="#111111">${esc(v.title)}</text>${v.body}${extra}</svg>`;
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
  const withKids = (es: Edge[]): C4Element[] => {
    const hit = new Set(touched(es));
    return shown.filter((e) => kids.includes(e) || hit.has(e));
  };
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
  drawio: boolean,
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
  // each link on a line of its own above the title, so a narrow view cuts neither off
  const targets = [
    ...(up === undefined ? [] : [{ to: up, text: `&#8593; Zoom out: ${esc(up.title)}` }]),
    ...(twin === undefined
      ? []
      : [{ to: twin, text: `&#8594; ${esc(twin.title.split(", ").pop() ?? "")}` }]),
  ];
  const lift = 24 * targets.length;
  const nav = targets.map(
    (t, i) =>
      `<a href="${esc(fileOf(t.to.name))}"><text x="0" y="${-44 - 24 * (targets.length - 1 - i)}" font-size="13" fill="#08427b" text-decoration="underline">${t.text}</text></a>`,
  );
  return `${svgOf(v, lift, `<g class="zoom-links">${links.join("")}${nav.join("")}</g>`, drawio)}\n`;
}

const viewName = (project: string, view: string): string => `${project}.${view}.drawio.svg`;

/** Every view of the graph: the context, the containers of each internal system, the components of
 * each container that has any. A `.drawio.svg` carries its draw.io diagram; a page that only shows
 * the picture asks for it without. */
export async function renderC4(
  m: C4Model,
  project: string,
  drawio = true,
): Promise<(Picture & { readonly title: string })[]> {
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
  const defects = views.flatMap((v) => v.defects.map((d) => `${fileOf(v.name)}: ${d}`));
  if (defects.length > 0) {
    throw new QsmError("worse", `the layout paints lines touching: ${defects.join("; ")}`, {
      next: "restructure the graph: groups, levels or relations, not coordinates",
    });
  }
  return views.map((v) => ({
    name: fileOf(v.name),
    title: v.title,
    svg: withZoomLinks(v, views, fileOf, g, drawio),
  }));
}
