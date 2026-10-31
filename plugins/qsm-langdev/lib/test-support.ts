// What the tests share: a value a test knows is there, read without a cast.

import { resolveRef, type Sha } from "./gitref.ts";

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
