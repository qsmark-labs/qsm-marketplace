// The delete guard's whole decision, as a function of the command line alone: no engine, no Node,
// no filesystem. Only the owner deletes a snapshot, and the owner's `!` command never reaches it.
// The line is split into commands and words the way the shell would, quotes removed, so a quoted
// binary or verb is still seen and a quoted mention in an argument is not; the text a shell runs
// again (`bash -c`, `eval`, a `$(...)` inside double quotes) is read as a line of its own.

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
function isCommandFlag(word: string): boolean {
  if (word.length < 2 || !word.startsWith("-") || !word.includes("c")) {
    return false;
  }
  for (const ch of word.slice(1)) {
    if (ch < "a" || ch > "z") {
      return false;
    }
  }
  return true;
}

/** The script a shell at `i` runs with `-c`, or null. */
function scriptOf(words: readonly string[], i: number): string | null {
  const flag = words.findIndex((w, at) => at > i && isCommandFlag(w));
  return flag < 0 ? null : (words[flag + 1] ?? null);
}

/** The id a command's words delete, or null: the binary itself, a shell's `-c` script, `eval`. */
function deletedIn(words: readonly string[], depth: number): string | null {
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? "";
    const script = SHELLS.has(nameOf(word)) ? scriptOf(words, i) : null;
    const id = isBinary(word)
      ? deletedBy(words, i)
      : word === "eval"
        ? deletedInLine(words.slice(i + 1).join(" "), depth + 1)
        : script === null
          ? null
          : deletedInLine(script, depth + 1);
    if (id !== null) {
      return id;
    }
  }
  return null;
}

/** The id `line` deletes, or null; a line run again more than four levels deep is not read. */
function deletedInLine(line: string, depth: number): string | null {
  if (depth > 4) {
    return null;
  }
  const { commands, substituted } = new Splitter(line).run();
  for (const words of commands) {
    const id = deletedIn(words, depth);
    if (id !== null) {
      return id;
    }
  }
  for (const text of substituted) {
    const id = deletedInLine(text, depth + 1);
    if (id !== null) {
      return id;
    }
  }
  return null;
}

/** The refusal for a Bash line that deletes a snapshot, or null when it may run. */
export function deleteRefusal(line: string): string | null {
  const id = deletedInLine(line, 0);
  return id === null
    ? null
    : `qsm-docs: only the owner deletes a snapshot. Ask the owner whether it should go; if so, they run \`! qsm-docs delete ${id}\` themselves.`;
}
