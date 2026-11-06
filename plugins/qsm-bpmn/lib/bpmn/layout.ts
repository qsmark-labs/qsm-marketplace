// layout: geometry for each process of a file that has none, by bpmn-auto-layout, in the colours
// of the picture rule. A process that has geometry is never laid out again, because the layout the
// owner made in bpmn.io must survive.
import { readFileSync } from "node:fs";
import { layoutProcess } from "bpmn-auto-layout";
import { writeAtomic } from "../../../../lib/fs.ts";
import { fail, ok, type Outcome } from "../../../../lib/outcome.ts";
import { PALETTE } from "../../../../lib/palette.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import { c4Elements } from "../c4-ids.ts";
import {
  c4Element,
  type Definitions,
  type Diagram,
  diagramOf,
  isModdle,
  type Lane,
  newLabel,
  parseXml,
  type Process,
  processesOf,
  type Shape,
  toXml,
} from "./model.ts";

const COLOURS = Object.values(PALETTE);

/** A colour mixed toward white or black by `by` (0 keeps it). */
function mix(hex: string, toward: number, by: number): string {
  const ch = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `#${ch
    .map((c) =>
      Math.round(c + (toward - c) * by)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const lanesOf = (p: Process): Lane[] => (p.laneSets ?? []).flatMap((s) => s.lanes ?? []);

/** The colour of each lane and of each node in it: a lane linked to a C4 actor takes the actor's
 * colour; the others take the palette colours the linked lanes left, in lane order. */
function laneColours(
  p: Process,
  defs: Definitions,
  actors: ReadonlyMap<string, string>,
): Map<string, string> {
  const laneOf = new Map<string, string>();
  const taken = new Set(actors.values());
  const free = COLOURS.filter((c) => !taken.has(c));
  let next = 0;
  for (const l of lanesOf(p)) {
    const link = c4Element(l, defs);
    const linked = link === undefined ? undefined : actors.get(link);
    const c = linked ?? free[next++];
    if (c === undefined) {
      throw new QsmError(
        "failed",
        `${p.id ?? "a process"}: lane ${l.name ?? l.id ?? ""} has no palette colour left, the ${free.length} free ones are taken`,
        { next: "link a lane to its C4 actor with c4:element, so it shares the actor's colour" },
      );
    }
    for (const id of [l.id, ...(l.flowNodeRef ?? []).map((n) => n.id)]) {
      laneOf.set(id ?? "", c);
    }
  }
  return laneOf;
}

/** The colour of each C4 element the lanes of these processes link to, read through qsm-c4; a
 * link it cannot resolve fails here. */
function linkedColours(file: string, defs: Definitions, todo: Process[]): Map<string, string> {
  const links = todo
    .flatMap(lanesOf)
    .map((l) => c4Element(l, defs))
    .filter((v) => v !== undefined);
  const out = new Map<string, string>();
  if (links.length === 0) {
    return out;
  }
  const listed = c4Elements(file);
  for (const link of links) {
    const e = listed.get(link);
    if (e === undefined) {
      throw new QsmError(
        "failed",
        `${file}: a lane links c4:element="${link}", which names no element of the C4 graph`,
        { next: "run qsm-bpmn lint" },
      );
    }
    if (e.colour === undefined) {
      throw new QsmError(
        "failed",
        `${file}: a lane links to ${link}, which is no actor with a palette colour`,
        { next: "link the lane to a person or agent of the C4 graph" },
      );
    }
    out.set(link, e.colour);
  }
  return out;
}

function paint(s: Shape, stroke: string, fill?: string): void {
  s.set("bioc:stroke", stroke);
  s.set("color:border-color", stroke);
  if (fill !== undefined) {
    s.set("bioc:fill", fill);
    s.set("color:background-color", fill);
  }
}

const STEP = /Task$|^bpmn:(CallActivity|SubProcess)$/;

/** A lane tinted; a step filled in its lane's colour with white text; events and gateways outlined
 * in it; a flow in the colour of the lane it starts in. */
function paintShape(s: Shape, c: string): void {
  const type = s.bpmnElement?.$type ?? "";
  if (type === "bpmn:Lane") {
    paint(s, c, mix(c, 255, 0.76));
  } else if (STEP.test(type)) {
    paint(s, mix(c, 0, 0.4), c);
    s.label ??= newLabel();
    s.label.set("color:color", "#ffffff");
  } else if (type === "bpmn:SequenceFlow") {
    paint(s, c);
  } else if (type !== "bpmn:Participant") {
    paint(s, c, "#ffffff");
  }
}

function colour(
  p: Process,
  d: Diagram,
  defs: Definitions,
  actors: ReadonlyMap<string, string>,
): void {
  const laneOf = laneColours(p, defs, actors);
  for (const s of d.plane.planeElement ?? []) {
    const e = s.bpmnElement;
    const source = e !== undefined && "sourceRef" in e && isModdle(e.sourceRef) ? e.sourceRef : e;
    paintShape(s, laneOf.get(source?.id ?? "") ?? "#333333");
  }
}

/** The processes of a file that have no diagram. */
const undrawn = (defs: Definitions): Process[] =>
  processesOf(defs).filter((p) => diagramOf(defs, p.id ?? "") === undefined);

export async function layoutFile(file: string): Promise<Outcome<{ laidOut: string[] }>> {
  const xml = readFileSync(file, "utf8");
  const defs = await parseXml(xml, file);
  const todo = undrawn(defs);
  if (todo.length === 0) {
    return fail(
      "blocked",
      `${file} has a layout: every process is drawn, and layout never redraws one`,
      { laidOut: [] },
    );
  }
  const actors = linkedColours(file, defs, todo);
  const laid = await parseXml((await layoutProcess(xml)).xml, file);
  for (const p of todo) {
    const d = diagramOf(laid, p.id ?? "");
    if (d === undefined) {
      return fail(
        "failed",
        `bpmn-auto-layout drew no diagram for ${p.id ?? "a process"} of ${file}`,
        { laidOut: [] },
      );
    }
    // the lanes are read from the file as written, which keeps their c4:element links
    colour(p, d, defs, actors);
    defs.diagrams = [...(defs.diagrams ?? []), d];
  }
  writeAtomic(file, await toXml(defs));
  const ids = todo.map((p) => p.id ?? "");
  return ok({ laidOut: ids }, `${file}: laid out ${ids.join(", ")}`);
}
