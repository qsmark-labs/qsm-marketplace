// The file sets a run hands its checkers, each computed once per run: which set a checker scores is
// its registry declaration (`fileSet`), never its own choice at run time.

/** One set's size in the report. */
export interface SetSize {
  set: string;
  files: number;
}

/** A named path as a repository-relative prefix: `./src/` is `src`, and
 * `.` (or nothing at all) is the root, the empty prefix. */
function prefixOf(path: string): string {
  let out = path;
  while (out.startsWith("./")) {
    out = out.slice(2);
  }
  out = out.replace(/\/+$/, "");
  return out === "." ? "" : out;
}

/** Every listed path that is, or lies under, one of `named`; the root when
 * `named` is empty. Sorted, each path once. */
export function givenSet(listed: readonly string[], named: readonly string[]): string[] {
  const prefixes = named.length === 0 ? [""] : named.map(prefixOf);
  const under = (path: string): boolean =>
    prefixes.some((p) => p === "" || path === p || path.startsWith(`${p}/`));
  return [...new Set(listed)].filter(under).toSorted((a, b) => a.localeCompare(b));
}

/** One line: `changed: 2 files, given: 40 files`. */
export function describeSets(sets: readonly SetSize[]): string {
  return sets
    .map(({ set, files }) => `${set}: ${files} ${files === 1 ? "file" : "files"}`)
    .join(", ");
}
