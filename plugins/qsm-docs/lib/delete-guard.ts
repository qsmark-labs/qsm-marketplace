// The delete guard's whole decision, as a function of the command line and where the store lies:
// no engine, no Node, no filesystem. It stops an agent that deletes or overwrites the store by
// mistake, not a deliberate evasion, so it reads each command at its command position only (the
// first word, or the first after a known wrapper), and a word anywhere else is an argument. Only
// the owner deletes a snapshot or changes a file of the store; the owner's `!` command never
// reaches it. Out of scope: an interpreter's inline script, a shell fed on stdin, `$'...'`,
// `${VAR:-...}`, and a variable or `cd` carried along the line.

import { splitLine } from "./shell-split.ts";
import { docsIn } from "./store/layout.ts";

const nameOf = (word: string): string => word.split("/").at(-1) ?? word;

/** `NAME=value` before a command. */
function isAssignment(word: string): boolean {
  const eq = word.indexOf("=");
  if (eq < 1) {
    return false;
  }
  for (let at = 0; at < eq; at += 1) {
    const ch = word.charAt(at);
    const letter = (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
    if (!(letter || (at > 0 && ch >= "0" && ch <= "9"))) {
      return false;
    }
  }
  return true;
}

/** Wrappers that run the command after them, and their flags that take a value. */
const WRAPPERS: Readonly<Record<string, readonly string[]>> = {
  sudo: ["-u", "-g", "-C", "-D", "-h", "-p", "-U"],
  env: ["-u", "-C", "-S"],
  rtk: [],
  xargs: ["-I", "-n", "-L", "-P", "-d", "-E", "-s", "-a"],
  nohup: [],
  command: [],
  exec: ["-a"],
  time: [],
  nice: ["-n"],
  timeout: ["-s", "-k"],
};

/** Shell words that open a command list: the command is the word after them. */
const KEYWORDS = new Set(["do", "then", "else", "elif", "if", "while", "until", "!", "{"]);

/** The first word from `at` that is no flag of the wrapper, skipping a flag's value. */
function pastFlags(words: readonly string[], at: number, valued: readonly string[]): number {
  let i = at;
  while (i < words.length && (words[i] ?? "").startsWith("-")) {
    i += valued.includes(words[i] ?? "") ? 2 : 1;
  }
  return i;
}

/** The index past a wrapper or keyword at `i`, or null when the word there runs itself. */
function pastWrapper(words: readonly string[], i: number): number | null {
  const word = words[i] ?? "";
  const name = nameOf(word);
  const valued = KEYWORDS.has(word) ? [] : WRAPPERS[name];
  if (valued !== undefined) {
    const past = pastFlags(words, i + 1, valued);
    return name === "timeout" ? past + 1 : past;
  }
  if (name === "mise" && words[i + 1] === "exec") {
    const dashes = words.indexOf("--", i + 2);
    return dashes < 0 ? pastFlags(words, i + 2, []) : dashes + 1;
  }
  return name === "bun" ? pastFlags(words, words[i + 1] === "run" ? i + 2 : i + 1, []) : null;
}

/** The index of the command a list of words runs from `from`: past assignments and wrappers
 * (`sudo`, `env NAME=v`, `rtk`, `xargs`, `timeout <n>`, `nohup`, `command`, `exec`, `time`,
 * `nice`, `mise exec --`, `bun` and `bun run` for the script) and keywords (`do`, `then`). */
function commandAt(words: readonly string[], from: number): number {
  let i = from;
  for (let guard = 0; guard <= words.length; guard += 1) {
    while (i < words.length && isAssignment(words[i] ?? "")) {
      i += 1;
    }
    const past = pastWrapper(words, i);
    if (past === null) {
      return i;
    }
    i = past;
  }
  return i;
}

/** Where a command's words run a command: its command position, and the one after each of
 * find's `-exec` and `-execdir`. */
function positions(words: readonly string[]): number[] {
  const first = commandAt(words, 0);
  if (nameOf(words[first] ?? "") !== "find") {
    return [first];
  }
  const execs = words.flatMap((w, at) =>
    at > first && ["-exec", "-execdir", "-ok", "-okdir"].includes(w)
      ? [commandAt(words, at + 1)]
      : [],
  );
  return [first, ...execs];
}

/** The binary: `qsm-docs` on PATH, or its entry script run from any path, whose qsm.json alone of
 * this marketplace has a `delete` verb. */
const isBinary = (word: string): boolean =>
  nameOf(word) === "qsm-docs" || word.endsWith("scripts/cli.ts") || word.endsWith("scripts/cli");

/** The first word from `at` on that is no flag. */
const verbAt = (words: readonly string[], at: number): number => pastFlags(words, at, []);

/** The id the binary at `i` deletes (`<id>` when none follows), or null for another verb or a
 * call for help. */
function deletedBy(words: readonly string[], i: number): string | null {
  const verb = verbAt(words, i + 1);
  const help = words.slice(i + 1).some((w) => w === "--help" || w === "-h");
  return words[verb] === "delete" && !help ? (words[verbAt(words, verb + 1)] ?? "<id>") : null;
}

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish"]);

/** A short flag cluster holding `c`: `-c`, `-lc`, `-ec`. */
const COMMAND_FLAG = /^-[a-z]*c[a-z]*$/;

/** The script a shell at `i` runs with `-c`, or null. */
function scriptOf(words: readonly string[], i: number): string | null {
  // regex_dos does not apply: the pattern is anchored, one letter class on each side of one
  // literal, so it runs in time linear in the word, and the word is one the agent wrote.
  // nosemgrep: ajinabraham.njsscan.dos.regex_dos.regex_dos
  const flag = words.findIndex((w, at) => at > i && COMMAND_FLAG.test(w));
  return flag < 0 ? null : (words[flag + 1] ?? null);
}

/** The store's directory in each form a line may write it: absolute, with `~`, `$HOME` or
 * `$XDG_DATA_HOME`. */
export interface Homes {
  readonly home: string | undefined;
  readonly xdg: string | undefined;
}

/** The store under a home's `.local/share`. */
const shareOf = (root: string): string => docsIn(`${root}/.local/share`);

function storePrefixes({ home, xdg }: Homes): string[] {
  return [
    shareOf("~"),
    shareOf("$HOME"),
    shareOf("${HOME}"),
    docsIn("$XDG_DATA_HOME"),
    docsIn("${XDG_DATA_HOME}"),
    ...(home === undefined ? [] : [shareOf(home)]),
    ...(xdg === undefined ? [] : [docsIn(xdg)]),
  ];
}

/** `a//b/./c/` as `a/b/c`; `/` stays `/`. */
function normal(path: string): string {
  let p = path;
  while (p.includes("/./")) {
    p = p.replaceAll("/./", "/");
  }
  p = p.replaceAll(/\/{2,}/g, "/");
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/** Whether a word names the store or a file in it; with `above`, also a directory the store lies
 * in. A glob counts when the text before its first `*`, `?` or `[` begins the store's path. */
function touches(word: string, stores: readonly string[], above: boolean): boolean {
  const glob = Math.min(
    ...["*", "?", "["].map((c) => (word.includes(c) ? word.indexOf(c) : Number.POSITIVE_INFINITY)),
  );
  const globbed = Number.isFinite(glob);
  const path = normal(globbed ? word.slice(0, glob) : word);
  if (globbed) {
    return path !== "" && stores.some((s) => s.startsWith(path) || path.startsWith(`${s}/`));
  }
  return stores.some(
    (s) =>
      path === s ||
      path.startsWith(`${s}/`) ||
      (above && s.startsWith(`${path === "/" ? "" : path}/`)),
  );
}

/** sed's and perl's in-place flag: `-i`, `-i.bak`, a cluster such as `-pi`, or `--in-place`. */
const inPlace = (word: string): boolean =>
  word.startsWith("--in-place") ||
  (word.startsWith("-") && !word.startsWith("--") && word.includes("i"));

/** What find's `-exec` runs that removes or changes the files it finds. */
const FIND_WRITERS = new Set(["rm", "unlink", "shred", "mv", "chmod", "truncate"]);

/** A word a command writes, and whether a directory above the store counts too. */
type Target = readonly [string, boolean];

/** How a command names what it writes, from its arguments (flags removed), all its words after
 * it, and its words with its own index. */
type Targets = (
  args: readonly string[],
  rest: readonly string[],
  words: readonly string[],
  i: number,
) => Target[];

const each = (args: readonly string[], above: boolean): Target[] => args.map((w) => [w, above]);
const lastOf = (args: readonly string[], above: boolean): Target[] =>
  args.length > 0 ? [[args.at(-1) ?? "", above]] : [];

const TARGETS: Readonly<Record<string, Targets>> = {
  rm: (args) => each(args, true),
  chmod: (args) => each(args, true),
  unlink: (args) => each(args, false),
  shred: (args) => each(args, false),
  truncate: (args) => each(args, false),
  tee: (args) => each(args, false),
  // the sources leave, with the store when it lies in one; the destination only receives
  mv: (args) => [...each(args.slice(0, -1), true), ...lastOf(args, false)],
  cp: (args) => lastOf(args, false),
  ln: (args) => (args.length > 1 ? lastOf(args, false) : []),
  dd: (_args, rest) => rest.filter((w) => w.startsWith("of=")).map((w) => [w.slice(3), false]),
  sed: (args, rest) => (rest.some(inPlace) ? each(args, false) : []),
  perl: (args, rest) => (rest.some(inPlace) ? each(args, false) : []),
  rsync: (args, rest) => (rest.some((w) => w.startsWith("--delete")) ? lastOf(args, true) : []),
  find: (_args, _rest, words, i) => findTargets(words, i),
};

/** The words a command at `i` writes, each with whether a directory above the store counts. */
function targetsOf(words: readonly string[], i: number): Target[] {
  const targets = TARGETS[nameOf(words[i] ?? "")];
  const rest = words.slice(i + 1);
  return targets === undefined
    ? []
    : targets(
        rest.filter((w) => !w.startsWith("-")),
        rest,
        words,
        i,
      );
}

/** find's search roots when it deletes what it finds (`-delete`, or `-exec` of a remover). */
function findTargets(words: readonly string[], i: number): Target[] {
  const deletes =
    words.includes("-delete") ||
    words.some(
      (w, at) =>
        ["-exec", "-execdir", "-ok", "-okdir"].includes(w) &&
        FIND_WRITERS.has(nameOf(words[commandAt(words, at + 1)] ?? "")),
    );
  const end = words.findIndex((w, at) => at > i && (w.startsWith("-") || w === "!"));
  const roots = words.slice(i + 1, end < 0 ? words.length : end);
  return deletes ? each(roots, true) : [];
}

/** The file a `>`, `>>` or `>|` redirect writes, glued (`>file`, `2>>file`) or the next word. */
function redirectedTo(words: readonly string[], at: number): string | null {
  const word = words[at] ?? "";
  const arrow = word.lastIndexOf(">");
  if (arrow < 0) {
    return null;
  }
  const glued = word.slice(arrow + 1).replace(/^\|/, "");
  return glued === "" ? (words[at + 1] ?? null) : glued;
}

/** What a command does to the store: deletes a snapshot through the verb, or writes a file of it. */
type Hit = { readonly delete: string } | { readonly write: true };

/** Whether a redirect anywhere in a command's words writes a file of the store. */
const redirectsInto = (words: readonly string[], stores: readonly string[]): boolean =>
  words.some((_w, at) => {
    const target = redirectedTo(words, at);
    return target !== null && touches(target, stores, false);
  });

/** What the command at `at` does to the store: the binary's delete, a write, or what a shell's
 * `-c` script or `eval` does. */
function hitAt(
  words: readonly string[],
  at: number,
  depth: number,
  stores: readonly string[],
): Hit | null {
  const word = words[at] ?? "";
  const id = isBinary(word) ? deletedBy(words, at) : null;
  if (id !== null) {
    return { delete: id };
  }
  if (targetsOf(words, at).some(([target, above]) => touches(target, stores, above))) {
    return { write: true };
  }
  const script = word === "eval" ? words.slice(at + 1).join(" ") : null;
  const run = script ?? (SHELLS.has(nameOf(word)) ? scriptOf(words, at) : null);
  return run === null ? null : hitInLine(run, depth + 1, stores);
}

/** What a command's words do to the store, or null. */
function hitIn(words: readonly string[], depth: number, stores: readonly string[]): Hit | null {
  if (redirectsInto(words, stores)) {
    return { write: true };
  }
  for (const at of positions(words)) {
    const hit = hitAt(words, at, depth, stores);
    if (hit !== null) {
      return hit;
    }
  }
  return null;
}

/** What `line` does to the store, or null; a line run again more than four levels deep is not
 * read. */
function hitInLine(line: string, depth: number, stores: readonly string[]): Hit | null {
  if (depth > 4) {
    return null;
  }
  const { commands, substituted } = splitLine(line);
  for (const words of commands) {
    const hit = hitIn(words, depth, stores);
    if (hit !== null) {
      return hit;
    }
  }
  for (const text of substituted) {
    const hit = hitInLine(text, depth + 1, stores);
    if (hit !== null) {
      return hit;
    }
  }
  return null;
}

/** The refusal for a Bash line that deletes a snapshot or writes a file of the store, or null when
 * it may run; a read of the store runs. */
export function deleteRefusal(line: string, homes: Homes): string | null {
  const hit = hitInLine(line, 0, storePrefixes(homes).map(normal));
  if (hit === null) {
    return null;
  }
  return "delete" in hit
    ? `qsm-docs: only the owner deletes a snapshot. Ask the owner whether it should go; if so, they run \`! qsm-docs delete ${hit.delete}\` themselves.`
    : `qsm-docs: only the owner changes the files of the qsm-docs store. Ask the owner; if they agree, they run \`! ${line.trim()}\` themselves.`;
}
