// The delete guard's whole decision, as a function of the command line and where the store lies:
// no engine, no Node, no filesystem. Only the owner deletes a snapshot or changes a file of the
// store, and the owner's `!` command never reaches it.
// The line is split into commands and words the way the shell would, quotes removed, so a quoted
// binary or verb is still seen and a quoted mention in an argument is not; the text a shell runs
// again (`bash -c`, `eval`, a `$(...)` inside double quotes) is read as a line of its own.

import { docsIn } from "./store/layout.ts";

/** The commands of a line, each its words with quotes removed, and the double-quoted texts that
 * hold a command substitution, which the shell runs. */
interface Split {
  readonly commands: string[][];
  readonly substituted: string[];
}

const SEPARATORS = new Set([";", "&", "|", "(", ")", "\n", "`"]);

/** Splits a line into commands and words: `'` and `"` quote, `\` escapes, separators and `$(`
 * end a command. */
class Splitter {
  readonly commands: string[][] = [[]];
  readonly substituted: string[] = [];
  private word: string | null = null;
  private quote: "'" | '"' | null = null;
  private quoted = "";

  constructor(private readonly line: string) {}

  run(): Split {
    for (let i = 0; i < this.line.length; i += 1) {
      i = this.quote === null ? this.plain(i) : this.inQuote(i);
    }
    this.endWord();
    return { commands: this.commands.filter((w) => w.length > 0), substituted: this.substituted };
  }

  private add(text: string): void {
    this.word = (this.word ?? "") + text;
  }

  private endWord(): void {
    if (this.word !== null) {
      this.commands.at(-1)?.push(this.word);
    }
    this.word = null;
  }

  /** One character inside quotes; the index of the last one it read. */
  private inQuote(i: number): number {
    const c = this.line[i] ?? "";
    if (c === this.quote) {
      if (this.quote === '"' && (this.quoted.includes("$(") || this.quoted.includes("`"))) {
        this.substituted.push(this.quoted);
      }
      this.quote = null;
      return i;
    }
    const escaped = this.quote === '"' && c === "\\" && i + 1 < this.line.length;
    const text = escaped ? (this.line[i + 1] ?? "") : c;
    this.add(text);
    this.quoted += text;
    return escaped ? i + 1 : i;
  }

  /** One character outside quotes; the index of the last one it read. */
  private plain(i: number): number {
    const c = this.line[i] ?? "";
    if (c === "'" || c === '"') {
      this.quote = c;
      this.quoted = "";
      this.add("");
    } else if (c === "\\" && i + 1 < this.line.length) {
      this.add(this.line[i + 1] ?? "");
      return i + 1;
    } else if (c === " " || c === "\t") {
      this.endWord();
    } else if (SEPARATORS.has(c) || (c === "$" && this.line[i + 1] === "(")) {
      this.endWord();
      this.commands.push([]);
      return c === "$" ? i + 1 : i;
    } else {
      this.add(c);
    }
    return i;
  }
}

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish"]);

const nameOf = (word: string): string => word.split("/").at(-1) ?? word;

/** The binary, by its name on PATH or the plugin's own entry run through bun. */
const isBinary = (word: string): boolean =>
  nameOf(word) === "qsm-docs" || word.endsWith("plugins/qsm-docs/scripts/cli.ts");

/** The first word from `at` on that is no flag. */
function verbAt(words: readonly string[], at: number): number {
  let i = at;
  while (i < words.length && (words[i] ?? "").startsWith("-")) {
    i += 1;
  }
  return i;
}

/** The id the binary at `i` deletes (`<id>` when none follows), or null for another verb. */
function deletedBy(words: readonly string[], i: number): string | null {
  const verb = verbAt(words, i + 1);
  return words[verb] === "delete" ? (words[verbAt(words, verb + 1)] ?? "<id>") : null;
}

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

/** What a command does to the store: deletes a snapshot through the verb, or writes a file of it. */
type Hit = { readonly delete: string } | { readonly write: true };

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

/** Whether `path` is the store's directory or lies under it. */
const underStore = (path: string, stores: readonly string[]): boolean =>
  stores.some((store) => path === store || path.startsWith(`${store}/`));

/** Whether `path` is a directory the store lies in (`~/.local/share`, `$XDG_DATA_HOME`, `~`, `/`):
 * removing, moving or re-moding it takes the store with it. */
function aboveStore(path: string, stores: readonly string[]): boolean {
  const dir = path.replace(/\/+$/, "");
  return stores.some((store) => store.startsWith(`${dir}/`));
}

/** Commands that change every file they name: remove, move, empty, change the mode, write. */
const WRITERS = new Set(["rm", "mv", "truncate", "chmod", "tee"]);

/** Commands that take every file below a directory they name. */
const TREE_WRITERS = new Set(["rm", "mv", "chmod"]);

/** sed's in-place flag: `-i`, `-i.bak`, a cluster such as `-Ei`, or `--in-place`. */
const inPlace = (word: string): boolean =>
  word.startsWith("--in-place") ||
  (word.startsWith("-") && !word.startsWith("--") && word.includes("i"));

/** The files a command at `i` writes: every argument of a writer, the last one of `cp` and of a
 * two-argument `ln`, `dd`'s `of=`, every one of `sed -i`. */
function writtenBy(words: readonly string[], i: number): readonly string[] {
  const name = nameOf(words[i] ?? "");
  const rest = words.slice(i + 1);
  const args = rest.filter((w) => !w.startsWith("-"));
  if (WRITERS.has(name)) {
    return args;
  }
  if (name === "cp" || (name === "ln" && args.length > 1)) {
    return args.slice(-1);
  }
  if (name === "dd") {
    return rest.filter((w) => w.startsWith("of=")).map((w) => w.slice("of=".length));
  }
  return name === "sed" && rest.some(inPlace) ? args : [];
}

/** Whether the command at `i` writes a file of the store, or removes, moves or re-modes a
 * directory the store lies in. */
function writesStore(words: readonly string[], i: number, stores: readonly string[]): boolean {
  const tree = TREE_WRITERS.has(nameOf(words[i] ?? ""));
  const target = redirectedTo(words, i);
  return (
    writtenBy(words, i).some(
      (path) => underStore(path, stores) || (tree && aboveStore(path, stores)),
    ) ||
    (target !== null && underStore(target, stores))
  );
}

/** The file a `>` or `>>` redirect writes, glued (`>file`, `2>>file`) or the next word. */
function redirectedTo(words: readonly string[], i: number): string | null {
  const word = words[i] ?? "";
  const at = word.lastIndexOf(">");
  if (at < 0) {
    return null;
  }
  const glued = word.slice(at + 1);
  return glued === "" ? (words[i + 1] ?? null) : glued;
}

/** What a command's words do to the store, or null: the binary's delete, a write under the store,
 * a shell's `-c` script, `eval`. */
function hitIn(words: readonly string[], depth: number, stores: readonly string[]): Hit | null {
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? "";
    const id = isBinary(word) ? deletedBy(words, i) : null;
    if (id !== null) {
      return { delete: id };
    }
    if (writesStore(words, i, stores)) {
      return { write: true };
    }
    const script = SHELLS.has(nameOf(word)) ? scriptOf(words, i) : null;
    const inner =
      word === "eval"
        ? hitInLine(words.slice(i + 1).join(" "), depth + 1, stores)
        : script === null
          ? null
          : hitInLine(script, depth + 1, stores);
    if (inner !== null) {
      return inner;
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
  const { commands, substituted } = new Splitter(line).run();
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
  const hit = hitInLine(line, 0, storePrefixes(homes));
  if (hit === null) {
    return null;
  }
  return "delete" in hit
    ? `qsm-docs: only the owner deletes a snapshot. Ask the owner whether it should go; if so, they run \`! qsm-docs delete ${hit.delete}\` themselves.`
    : `qsm-docs: only the owner changes the files of the qsm-docs store. Ask the owner; if they agree, they run \`! ${line.trim()}\` themselves.`;
}
