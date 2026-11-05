// What the tests share: a value a test knows is there, read without a cast.

import { readdirSync, readFileSync } from "node:fs";
import { resolveRef, type Sha } from "./gitref.ts";

/** Whether a live process has `text` in its command line, read from /proc so no binary is spawned. */
export function processWith(text: string): boolean {
  return readdirSync("/proc").some((pid) => {
    if (!/^\d+$/.test(pid) || Number(pid) === process.pid) {
      return false;
    }
    try {
      return readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ").includes(text);
    } catch {
      return false;
    }
  });
}

/** `value`, or a thrown error naming `what` when it is missing: a test that reads past the end of
 * an array fails loud at the read instead of asserting the type away. */
export function defined<T>(value: T | null | undefined, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

/** The commit `HEAD` names in `root`, as the id a comparison takes. */
export function headOf(root: string): Sha {
  return defined(resolveRef(root, "HEAD"), "a HEAD commit");
}
