// The refusal on geometry ELK produced: no plausible source makes today's layout paint a defect, so
// the defects are proved on views recorded from drawView with the lines between layers a gap apart
// and each label a gap from its line, which ELK routed into the touches named below.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isRecord } from "../../../../lib/outcome.ts";
import { defectsOf } from "./render.ts";

type Point = { x: number; y: number };
type Rect = Point & { w: number; h: number };
type Seg = [Point, Point];

const isPoint = (v: unknown): v is Point =>
  isRecord(v) && typeof v.x === "number" && typeof v.y === "number";
const isRect = (v: unknown): v is Rect =>
  isRecord(v) &&
  isPoint(v) &&
  "w" in v &&
  typeof v.w === "number" &&
  "h" in v &&
  typeof v.h === "number";
const isSeg = (v: unknown): v is Seg => Array.isArray(v) && v.length === 2 && v.every(isPoint);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
const rectOf = (v: unknown): Rect => {
  if (isRect(v)) {
    return v;
  }
  throw new Error(`not a box: ${JSON.stringify(v)}`);
};
const shapeOf = (v: unknown): Rect | Seg => (isSeg(v) ? v : rectOf(v));
const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** What drawView painted for one view, as recorded in lib/fixtures, and what defectsOf names. */
function recorded(name: string): string[] {
  const view: unknown = JSON.parse(
    readFileSync(join(import.meta.dir, "../fixtures", name), "utf8"),
  );
  if (!isRecord(view)) {
    throw new Error(`${name} is not a recorded view`);
  }
  const painted = listOf(view.painted)
    .filter(isRecord)
    .map((p) => ({
      what: String(p.what),
      owner: String(p.owner),
      shape: shapeOf(p.shape),
      ends: strings(p.ends),
      ports: listOf(p.ports).filter(isPoint),
    }));
  const drawn = listOf(view.drawn)
    .filter(isRecord)
    .map((l) => ({
      title: String(l.title),
      segs: listOf(l.segs).filter(isSeg),
      label: rectOf(l.label),
    }));
  return defectsOf(painted, drawn);
}

describe("defectsOf on recorded views", () => {
  it("names two lines that meet end to end on one track", () => {
    expect(recorded("touching-bpmn-depends.json")).toContain(
      'the line "installs the bpmn kind with [exec, stdio]" and the line "gets the base and branch snapshots with [exec, stdio]" are 9 px apart, closer than 16 px',
    );
  });

  it("names each such pair once, and a label a gap from its line", () => {
    const defects = recorded("touching-spec.json");
    expect(defects.filter((d) => d.endsWith("are 14 px apart, closer than 16 px"))).toEqual([
      'the line "hands disjoint work to the agents of [skill reference]" and the line "builds on cli-base, install-base, outcome, qsm-manifest [import]" are 14 px apart, closer than 16 px',
      'the line "has the agent bind the change to its feature with [instruction]" and the line "has the agent archive the change with [instruction]" are 14 px apart, closer than 16 px',
    ]);
    expect(defects).toContain(
      'the label of "hands disjoint work to the agents of [skill reference]" sits 16 px from its own line, farther than 8 px',
    );
  });

  it("names nothing in a view as render draws it today", () => {
    expect(recorded("clean-plan.json")).toEqual([]);
  });
});
