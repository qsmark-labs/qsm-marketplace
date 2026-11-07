// render for C4: one view per level, generated from the graph, laid out by ELK layered in tiers
// (actors, the system in scope with its groups, external systems), drawn as an SVG that carries
// the view's draw.io diagram, with links that zoom in and out between the views.
import ELK, { type ElkExtendedEdge, type ElkNode, type ElkShape } from "elkjs/lib/elk.bundled.js";
import { escapeHtml as esc } from "../../../../lib/html.ts";
import { PALETTE } from "../../../../lib/palette.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import type { Picture } from "../../../../lib/model-graph.ts";
import {
  GAP,
  gapBetween,
  type Painted,
  type Rect,
  ROUNDING,
  type Seg,
  STEP,
  sidesOf,
  spanOf,
  touchDefects,
} from "../../../../lib/touch.ts";
import { Cells } from "./drawio.ts";
import { textWidth } from "./font.ts";
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

/** The room ELK keeps between a line and a box. */
const EDGE_NODE = 3 * STEP;
/** The room inside a boundary or a group around what it holds: a line ELK routes along the inside
 * keeps the gap from what it passes, and so the gap from the outline too. */
const PADDING = 2 * GAP;

/** A label's text, in lines of at most `chars`, and the box it takes at `px`: as wide as its widest
 * line is drawn, a line 1.2 em high, with 0.2 em below. */
interface Label {
  readonly lines: string[];
  readonly px: number;
  readonly width: number;
  readonly height: number;
}

const labelOf = (text: string, px: number, chars = 24): Label => {
  const lines = wrap(text, chars);
  return {
    lines,
    px,
    width: Math.max(...lines.map((l) => textWidth(l, px))),
    height: lines.length * px * 1.2 + px * 0.2,
  };
};

/** The straight stretches of a line. ELK splits a stretch where it crosses into a boundary and may
 * shift it by a fraction of a pixel there; a point within a pixel of the run through its neighbours
 * is no bend, so the stretch stays one. */
function segsOf(ed: ElkExtendedEdge): Seg[] {
  return (ed.sections ?? []).flatMap((s) => {
    const q = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
    const bends = q.filter((p, i) => {
      const [a, b] = [q[i - 1], q[i + 1]];
      return (
        a === undefined ||
        b === undefined ||
        !(
          (Math.abs(a.x - p.x) < 1 && Math.abs(b.x - p.x) < 1) ||
          (Math.abs(a.y - p.y) < 1 && Math.abs(b.y - p.y) < 1)
        )
      );
    });
    return bends.slice(1).map((v, i): Seg => [bends[i] ?? v, v]);
  });
}

/** A line as drawn: its title, its stretches and its label. */
interface DrawnLine {
  readonly title: string;
  readonly segs: Seg[];
  readonly label: Rect;
}

/** Why a line's label does not read as that line's: farther than a step from it, or not a step
 * nearer it than to any other line; nothing when it reads right. */
function labelStrays(e: DrawnLine, edges: readonly DrawnLine[]): string | undefined {
  const mine = Math.min(...e.segs.map((s) => gapBetween(e.label, spanOf(s))));
  const other = Math.min(
    ...edges
      .filter((f) => f !== e)
      .flatMap((f) => f.segs.map((s) => gapBetween(e.label, spanOf(s)))),
  );
  if (Math.round(mine) > STEP + ROUNDING) {
    return `the label of "${e.title}" sits ${Math.round(mine)} px from its own line, farther than ${STEP} px`;
  }
  return other - mine < STEP - ROUNDING
    ? `the label of "${e.title}" sits ${Math.round(other)} px from another line and ${Math.round(mine)} px from its own, not ${STEP} px nearer its own`
    : undefined;
}

/** What a view paints that render refuses: things that touch, and labels that do not read as
 * their own line's. */
export function defectsOf(painted: readonly Painted[], drawn: readonly DrawnLine[]): string[] {
  return [...touchDefects(painted), ...drawn.flatMap((l) => labelStrays(l, drawn) ?? [])];
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

/** The gaps of the scale as ELK reads them; it reads them per graph, so every compound node carries
 * them too, or the lines inside it keep ELK's own smaller defaults. */
const SPACING = {
  "elk.spacing.edgeEdge": String(GAP),
  "elk.spacing.edgeNode": String(EDGE_NODE),
  "elk.layered.spacing.edgeNodeBetweenLayers": String(EDGE_NODE),
  // ELK's router keeps two stretches between layers off one track only when their ends lie within
  // half this spacing of each other, so two gaps keep every end on a shared track a gap apart
  "elk.layered.spacing.edgeEdgeBetweenLayers": String(2 * GAP),
  // ELK gives each end of a line a port of its own on the box, this far from the next
  "elk.spacing.portPort": String(GAP),
  // a label sits a step from its own line, while every other line keeps at least the gap from it,
  // so it reads as that line's
  "elk.spacing.edgeLabel": String(STEP),
  "elk.spacing.labelLabel": String(GAP),
  "elk.spacing.labelNode": String(GAP),
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

/** A boundary or a group: the scale's gaps, the padding all round, and its title as a label ELK
 * places inside at `where` and keeps the room for. */
const compound = (where: "V_TOP" | "V_BOTTOM"): Record<string, string> => ({
  ...SPACING,
  "elk.padding": `[top=${PADDING},left=${PADDING},bottom=${PADDING},right=${PADDING}]`,
  "elk.nodeLabels.placement": `[H_LEFT, ${where}, INSIDE]`,
  "elk.nodeLabels.padding": `[top=${STEP},left=${STEP},bottom=${STEP},right=${STEP}]`,
  "elk.nodeSize.constraints": "[NODE_LABELS]",
});

/** A label's text in its box, each line centred, the first line's baseline one em down. */
function textIn(l: Label, r: Rect, ink: string, extra = ""): string {
  const cx = r.x + r.w / 2;
  return `<text x="${cx}" y="${r.y + l.px}" font-size="${l.px}" fill="${ink}" text-anchor="middle"${extra}>${l.lines.map((t, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : l.px * 1.2}">${esc(t)}</tspan>`).join("")}</text>`;
}

/** A boundary or a group as a touch sees it: its title, and its four sides, which may touch the
 * title they hold. */
const outlined = (owner: string, what: string, box: Rect, title: Rect): Painted[] => [
  { what: `the title of ${owner}`, owner, shape: title },
  ...sidesOf(box).map((s) => ({ what, owner, shape: s })),
];

/** A shape ELK placed, as a box in the coordinates of the view, its parent at `ox`, `oy`. */
const rectOf = (s: ElkShape, ox: number, oy: number): Rect => ({
  x: ox + (s.x ?? 0),
  y: oy + (s.y ?? 0),
  w: s.width ?? 0,
  h: s.height ?? 0,
});

/** Where ELK put each node and each node label, in the view's own coordinates. */
function placesOf(out: ElkNode): { box: Map<string, Rect>; label: Map<string, Rect> } {
  const box = new Map<string, Rect>();
  const label = new Map<string, Rect>();
  const walk = (n: ElkNode, ox: number, oy: number): void => {
    const r = rectOf(n, ox, oy);
    box.set(n.id, r);
    const l = n.labels?.[0];
    if (l !== undefined) {
      label.set(n.id, rectOf(l, r.x, r.y));
    }
    for (const c of n.children ?? []) {
      walk(c, r.x, r.y);
    }
  };
  walk(out, 0, 0);
  return { box, label };
}

/** A line's label where ELK put it; a line ELK gave no label is a layout this renderer cannot
 * draw. */
function lineLabel(ed: ElkExtendedEdge): Rect {
  const l = ed.labels?.[0];
  if (l === undefined) {
    throw new QsmError("failed", `ELK placed no label for the line ${ed.id}`);
  }
  return rectOf(l, 0, 0);
}

/** A line ELK routed, with the relation it draws, its label's text and where ELK put that label. */
interface RoutedLine {
  readonly ed: ElkExtendedEdge;
  readonly rel: Edge;
  readonly label: Label;
  readonly segs: Seg[];
  readonly at: Rect;
}

/** Draws each line into `svg` and the diagram, adds what it paints to `painted`, and returns its
 * labels, which go on top of everything else. */
function paintLines(
  g: Graph4,
  lines: readonly RoutedLine[],
  svg: string[],
  cells: Cells,
  painted: Painted[],
): string[] {
  const labels: string[] = [];
  for (const [k, { ed, rel, label, segs, at: spot }] of lines.entries()) {
    const c = g.lineColour(rel.from);
    const dash = g.actorColour(rel.from) === undefined;
    for (const s of ed.sections ?? []) {
      const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
      svg.push(
        `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2.4"${dash ? ' stroke-dasharray="5 3"' : ""} marker-end="url(#a${c.slice(1)})"/>`,
      );
      cells.relation(rel.from, rel.to, rel.title, s.bendPoints ?? [], c, dash);
    }
    labels.push(
      `<rect x="${spot.x}" y="${spot.y}" width="${spot.w}" height="${spot.h}" rx="2" fill="#ffffff"/>`,
      textIn(label, spot, c),
    );
    const owner = `line ${k}`;
    const ports = [segs[0]?.[0], segs.at(-1)?.[1]].filter((p) => p !== undefined);
    painted.push(
      { what: `the label of "${rel.title}"`, owner, shape: spot },
      ...segs.map((s) => ({
        what: `the line "${rel.title}"`,
        owner,
        shape: s,
        ends: [rel.from, rel.to],
        ports,
      })),
    );
  }
  return labels;
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
  const byEdge = new Map(lines.map((r, k) => [`e${k}`, { rel: r, label: labelOf(r.title, 10) }]));
  const kind = boundary?.kind === "system" ? "software system" : "container";
  const framed =
    boundary === null
      ? null
      : {
          el: boundary,
          // drawn as the title in bold and its kind in a smaller regular face
          title: {
            ...labelOf(boundary.title, 13, 99),
            width: textWidth(`${boundary.title} `, 13, true) + textWidth(`[${kind}]`, 9),
          },
        };
  const groupTitles = groups.map((grp) => ({ grp, label: labelOf(grp, 11, 99) }));
  const graph: ElkNode = {
    id: "root",
    layoutOptions: LAYOUT,
    children: [
      ...outside.map((e) => ({
        ...leaf(e),
        layoutOptions: { "elk.partitioning.partition": String(g.tier(e)) },
      })),
      ...(framed === null
        ? []
        : [
            {
              id: framed.el.id,
              labels: [
                { text: framed.el.title, width: framed.title.width, height: framed.title.height },
              ],
              layoutOptions: { "elk.partitioning.partition": "1", ...compound("V_BOTTOM") },
              children: [
                ...groupTitles.map(({ grp, label }, k) => ({
                  id: `group-${k}`,
                  labels: [{ text: grp, width: label.width, height: label.height }],
                  layoutOptions: compound("V_TOP"),
                  children: inside.filter((e) => e.metadata.group === grp).map(leaf),
                })),
                ...inside.filter((e) => e.metadata.group === undefined).map(leaf),
              ],
            },
          ]),
    ],
    edges: [
      ...[...byEdge].map(([id, { rel, label }]) => ({
        id,
        sources: [rel.from],
        targets: [rel.to],
        labels: [{ text: rel.title, width: label.width, height: label.height }],
      })),
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
  const places = placesOf(out);
  const at = (id: string): Rect => places.box.get(id) ?? { x: 0, y: 0, w: 0, h: 0 };
  const titleAt = (id: string): Rect => places.label.get(id) ?? { x: 0, y: 0, w: 0, h: 0 };
  const drawnLines = (out.edges ?? []).flatMap((ed) => {
    const line = byEdge.get(ed.id);
    return line === undefined ? [] : [{ ed, ...line, segs: segsOf(ed), at: lineLabel(ed) }];
  });

  const svg: string[] = [];
  const cells = new Cells();
  // titles are drawn after the lines, each on its own background, so a line passes under a title
  const titles: string[] = [];
  const painted: Painted[] = shown.map((e) => ({
    what: `the box of ${e.id}`,
    owner: e.id,
    shape: at(e.id),
  }));
  if (framed !== null) {
    const { el } = framed;
    const b = at(el.id);
    const t = titleAt(el.id);
    svg.push(rectSvg(b, "none", "#555555", true, 12));
    titles.push(
      `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="#ffffff"/>`,
      `<text x="${t.x + t.w / 2}" y="${t.y + framed.title.px}" font-size="13" font-weight="bold" fill="#222222" text-anchor="middle">${esc(el.title)} <tspan font-size="9" font-weight="normal">[${kind}]</tspan></text>`,
    );
    cells.boundary(el, b);
    painted.push(...outlined(el.id, `the outline of ${el.id}`, b, t));
    for (const [k, { grp, label }] of groupTitles.entries()) {
      const gb = at(`group-${k}`);
      const gt = titleAt(`group-${k}`);
      const [fill, stroke] = tint(grp);
      svg.push(rectSvg(gb, fill, stroke, false, 10));
      titles.push(
        `<rect x="${gt.x}" y="${gt.y}" width="${gt.w}" height="${gt.h}" rx="3" fill="${fill}"/>`,
        textIn(label, gt, "#333333"),
      );
      cells.group(grp, gb, fill, stroke);
      painted.push(...outlined(`group-${k}`, `the outline of the group ${grp}`, gb, gt));
    }
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
  const labels = paintLines(g, drawnLines, svg, cells, painted);
  svg.push(...titles, ...labels);
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
  const drawn = drawnLines.map((l) => ({ title: l.rel.title, segs: l.segs, label: l.at }));
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
    defects: defectsOf(painted, drawn),
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
