// The one kind qsm-docs carries itself: a JSON document. Its converter checks the text parses and
// prints it; its diff names each path that was added, removed or changed.
import { isRecord } from "../../../../lib/outcome.ts";
import type { Change } from "./change.ts";

/** The document as JSON, or a throw with the parser's message. */
export function convertJson(text: string): string {
  return `${JSON.stringify(JSON.parse(text))}\n`;
}

/** `a.b`, `a[0]`: the path of a member below `at`. */
const below = (at: string, key: string | number): string =>
  typeof key === "number" ? `${at}[${key}]` : at === "" ? key : `${at}.${key}`;

/** The members of an object or an array, by key or index. */
function members(value: unknown): Map<string | number, unknown> | null {
  if (Array.isArray(value)) {
    return new Map(value.map((v, i) => [i, v]));
  }
  return isRecord(value) ? new Map(Object.entries(value)) : null;
}

/** Every path where `b` differs from `a`, the members of an added or removed one left out. */
function walk(a: unknown, b: unknown, at: string, out: Change[]): void {
  const ma = members(a);
  const mb = members(b);
  if (ma === null || mb === null || Array.isArray(a) !== Array.isArray(b)) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push({ op: "changed", element: at === "" ? "$" : at });
    }
    return;
  }
  for (const [key, value] of ma) {
    if (mb.has(key)) {
      walk(value, mb.get(key), below(at, key), out);
    } else {
      out.push({ op: "removed", element: below(at, key) });
    }
  }
  for (const key of mb.keys()) {
    if (!ma.has(key)) {
      out.push({ op: "added", element: below(at, key) });
    }
  }
}

/** The changes from document `a` to document `b`. */
export function diffJson(a: string, b: string): Change[] {
  const out: Change[] = [];
  walk(JSON.parse(a), JSON.parse(b), "", out);
  return out;
}
