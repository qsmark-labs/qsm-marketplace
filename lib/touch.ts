// What a picture paints, as a touch sees it, and every pair of painted things closer than the gap
// of the spacing scale: the owner's rule that nothing a UI paints touches anything else, measured
// on a picture's own geometry.

/** The spacing scale: every gap a picture keeps is a multiple of one step. */
export const STEP = 8;
/** The smallest gap two painted bodies keep. */
export const GAP = 2 * STEP;
/** A measure this far past a spacing a layout was given is rounding, not a defect. */
export const ROUNDING = 1;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

type Point = { readonly x: number; readonly y: number };

/** A straight stretch of a line, from one point to the next. */
export type Segment = [Point, Point];

/** The four sides of a box: the lines an outline draws. */
export function sidesOf(r: Rect): Segment[] {
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

/** The box a segment spans. */
export const spanOf = ([u, v]: Segment): Rect => ({
  x: Math.min(u.x, v.x),
  y: Math.min(u.y, v.y),
  w: Math.abs(v.x - u.x),
  h: Math.abs(v.y - u.y),
});

/** The gap between two boxes, 0 where they touch or overlap. */
export const gapBetween = (p: Rect, q: Rect): number =>
  Math.hypot(
    Math.max(0, q.x - (p.x + p.w), p.x - (q.x + q.w)),
    Math.max(0, q.y - (p.y + p.h), p.y - (q.y + q.h)),
  );

/** Whether two stretches cross: one upright, one flat, each passing through the other's inside. A
 * crossing is a measure of the layout, not a touch. */
function crossing(s: Segment, t: Segment): boolean {
  const [p, q] = [spanOf(s), spanOf(t)];
  const [h, v] = p.h < 1 && q.w < 1 ? [p, q] : [q, p];
  return h.h < 1 && v.w < 1 && v.x > h.x && v.x < h.x + h.w && h.y > v.y && h.y < v.y + v.h;
}

const samePoint = (p: Point, q: Point): boolean => Math.hypot(p.x - q.x, p.y - q.y) < 1;

/** One thing a picture paints, as a touch sees it: a box or a straight stretch of line, what to
 * call it, who drew it, and for a line the boxes at its ends and the two points where it leaves
 * and enters them. */
export interface Painted {
  readonly what: string;
  readonly owner: string;
  readonly shape: Rect | Segment;
  readonly ends?: readonly string[];
  readonly ports?: readonly Point[];
}

const isSegment = (s: Rect | Segment): s is Segment => Array.isArray(s);

/** Whether two stretches meet at a port both lines start or end at. */
function sharePort(a: Painted, b: Painted): boolean {
  const [s, t] = [a.shape, b.shape];
  if (!isSegment(s) || !isSegment(t)) {
    return false;
  }
  return (a.ports ?? []).some(
    (p) =>
      (b.ports ?? []).some((q) => samePoint(p, q)) &&
      s.some((e) => samePoint(e, p)) &&
      t.some((e) => samePoint(e, p)),
  );
}

/** The gap between two painted things: the boxes they span, which for two straight stretches of
 * an upright and flat routing is their true distance; nothing for a crossing. */
const gapOf = (a: Rect | Segment, b: Rect | Segment): number =>
  isSegment(a) && isSegment(b) && crossing(a, b)
    ? Infinity
    : gapBetween(isSegment(a) ? spanOf(a) : a, isSegment(b) ? spanOf(b) : b);

/** Whether two painted things may touch: the parts of one owner (a line's stretches and its label,
 * an outline and its title), a line and the boxes at its ends, and two lines at a port they share. */
const mayTouch = (a: Painted, b: Painted): boolean =>
  a.owner === b.owner ||
  a.ends?.includes(b.owner) === true ||
  b.ends?.includes(a.owner) === true ||
  sharePort(a, b);

/** Every pair of painted things closer than the gap, less a pixel of rounding, that may not
 * touch, each named once however many of their stretches meet. */
export function touchDefects(painted: readonly Painted[]): string[] {
  const out = new Set<string>();
  for (const [i, a] of painted.entries()) {
    for (const b of painted.slice(i + 1)) {
      const gap = gapOf(a.shape, b.shape);
      if (gap < GAP - ROUNDING && !mayTouch(a, b)) {
        out.add(`${a.what} and ${b.what} are ${Math.round(gap)} px apart, closer than ${GAP} px`);
      }
    }
  }
  return [...out];
}
