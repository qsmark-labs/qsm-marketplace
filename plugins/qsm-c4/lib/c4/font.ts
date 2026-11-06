// The advance widths of the font a C4 view names, so a label's box is the width its text is drawn.
import { QsmError } from "../../../../lib/qsm-error.ts";

/** Helvetica's advance widths in thousandths of an em for the characters " " to "~", read from the
 * hmtx table of Nimbus Sans, the Helvetica a view's `font-family` resolves to; Arial and Liberation
 * Sans carry the same widths for every one of them. */
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** The same for Helvetica Bold, read from Nimbus Sans Bold. */
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** How wide `text` is drawn at `px`; a character outside the table has no known width. */
export function textWidth(text: string, px: number, bold = false): number {
  const table = bold ? BOLD : REGULAR;
  let units = 0;
  for (const c of text) {
    const advance = table[(c.codePointAt(0) ?? 0) - 32];
    if (advance === undefined) {
      throw new QsmError("failed", `no glyph width for "${c}" in "${text}"`, {
        next: "write titles and labels in printable ASCII",
      });
    }
    units += advance;
  }
  return (units * px) / 1000;
}
