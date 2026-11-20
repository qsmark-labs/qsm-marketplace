// Forge answers arrive as JSON of unknown shape. A guard checks the fields the code reads and
// narrows the value to the interface that names them, so no caller casts. A guard also says where
// a value stopped fitting, so a shape failure names the field instead of dumping the body.

import { isRecord } from "../../../lib/outcome.ts";

/** The first place a value stopped fitting: the path to it, the shape wanted there, and the type
 * found. The found part is a type name, never the value, because a body can hold personal text. */
interface Mismatch {
  readonly path: string;
  readonly expected: string;
  readonly found: string;
}

export interface Guard<T> {
  (value: unknown): value is T;
  /** Null when the guard accepts the value, else where it stopped fitting. `path` is where the
   * value itself sits in the response, empty at the top. */
  readonly mismatch: (value: unknown, path: string) => Mismatch | null;
}

function foundOf(value: unknown): string {
  if (value === undefined) {
    return "absent";
  }
  if (value === null) {
    return "null";
  }
  return Array.isArray(value) ? "array" : typeof value;
}

function guardOf<T>(mismatch: (value: unknown, path: string) => Mismatch | null): Guard<T> {
  return Object.assign((value: unknown): value is T => mismatch(value, "") === null, { mismatch });
}

function primitiveOf<T>(expected: string, accepts: (value: unknown) => value is T): Guard<T> {
  return guardOf<T>((value, path) =>
    accepts(value) ? null : { path, expected, found: foundOf(value) },
  );
}

export const isString = primitiveOf<string>(
  "string",
  (value): value is string => typeof value === "string",
);
export const isNumber = primitiveOf<number>(
  "number",
  (value): value is number => typeof value === "number",
);
export const isBoolean = primitiveOf<boolean>(
  "boolean",
  (value): value is boolean => typeof value === "boolean",
);

/** The value is the alternative, or the inner guard accepts it. A mismatch at this very place also
 * names the alternative; one deeper inside the value stays as it is. */
function orAlso<T, A>(
  inner: Guard<T>,
  label: string,
  isAlternative: (value: unknown) => value is A,
): Guard<T | A> {
  return guardOf<T | A>((value, path) => {
    if (isAlternative(value)) {
      return null;
    }
    const found = inner.mismatch(value, path);
    return found !== null && found.path === path
      ? { ...found, expected: `${found.expected} or ${label}` }
      : found;
  });
}

/** The value is null, or the inner guard accepts it. */
export function orNull<T>(inner: Guard<T>): Guard<T | null> {
  return orAlso(inner, "null", (value): value is null => value === null);
}

/** The value is absent, or the inner guard accepts it. */
export function orAbsent<T>(inner: Guard<T>): Guard<T | undefined> {
  return orAlso(inner, "absent", (value): value is undefined => value === undefined);
}

export function arrayOf<T>(inner: Guard<T>): Guard<readonly T[]> {
  return guardOf<readonly T[]>((value, path) => {
    if (!Array.isArray(value)) {
      return { path, expected: "array", found: foundOf(value) };
    }
    for (const [index, item] of value.entries()) {
      const found = inner.mismatch(item, `${path}[${String(index)}]`);
      if (found !== null) {
        return found;
      }
    }
    return null;
  });
}

/** An object whose every named field passes its guard; other fields are left alone. A field that
 * may be missing takes `orAbsent`. */
export function objectOf<T extends object>(fields: {
  readonly [K in keyof T]-?: Guard<T[K]>;
}): Guard<T> {
  const entries = Object.entries<Guard<unknown>>(fields);
  return guardOf<T>((value, path) => {
    if (!isRecord(value)) {
      return { path, expected: "object", found: foundOf(value) };
    }
    for (const [name, guard] of entries) {
      const found = guard.mismatch(value[name], path === "" ? name : `${path}.${name}`);
      if (found !== null) {
        return found;
      }
    }
    return null;
  });
}
