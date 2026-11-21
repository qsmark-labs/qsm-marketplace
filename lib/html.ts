// What a plugin writes into HTML, SVG or XML: the one escape for element content and quoted
// attribute values of either quote, a page template filled, and a page written to disk.
import { mkdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { writeAtomic } from "./fs.ts";
import { QsmError } from "./qsm-error.ts";

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** `text` with `& < > " '` written as entities, so it can never open a tag or close a value. */
export function escapeHtml(text: string): string {
  return text.replaceAll(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

/** Fills each `marker` of a template once, the value taken literally. */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce((page, [marker, value]) => {
    const parts = page.split(marker);
    if (parts.length !== 2) {
      throw new QsmError(
        "failed",
        `a page template holds ${marker} ${parts.length - 1} times, not once`,
      );
    }
    return parts.join(value);
  }, template);
}

/** Writes `html` as `name` into `dir`, replacing an earlier run; returns the path and the line that
 * names it with its size. */
export function writePage(dir: string, name: string, html: string): { path: string; line: string } {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeAtomic(path, html);
  const size = Math.round(readFileSync(path).length / 1024);
  return { path, line: `wrote ${relative(process.cwd(), path) || path} (${size} KB)` };
}
