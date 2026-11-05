// layout: geometry for each process of a file that has none, by bpmn-auto-layout, in the colours
// of the picture rule. A process that has geometry is never laid out again, because the layout the
// owner made in bpmn.io must survive.
import { readFileSync } from "node:fs";
import { layoutProcess } from "bpmn-auto-layout";
import { writeAtomic } from "../../../../lib/fs.ts";
import { fail, ok, type Outcome } from "../../../../lib/outcome.ts";
import { PALETTE } from "../c4/style.ts";
import {
  type Definitions,
  type Diagram,
  diagramOf,
  isModdle,
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

/** The colour of each lane and of each node in it: the palette in lane order. */
function laneColours(p: Process): Map<string, string> {
  const laneOf = new Map<string, string>();
  const lanes = (p.laneSets ?? []).flatMap((s) => s.lanes ?? []);
  lanes.forEach((l, i) => {
    const c = COLOURS[i % COLOURS.length] ?? "#333333";
    for (const id of [l.id, ...(l.flowNodeRef ?? []).map((n) => n.id)]) {
      laneOf.set(id ?? "", c);
    }
  });
  return laneOf;
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

function colour(p: Process, d: Diagram): void {
  const laneOf = laneColours(p);
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
    const lp = processesOf(laid).find((x) => x.id === p.id);
    if (lp !== undefined) {
      colour(lp, d);
    }
    defs.diagrams = [...(defs.diagrams ?? []), d];
  }
  writeAtomic(file, await toXml(defs));
  const ids = todo.map((p) => p.id ?? "");
  return ok({ laidOut: ids }, `${file}: laid out ${ids.join(", ")}`);
}
