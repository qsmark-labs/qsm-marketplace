// A Bash line split the way the shell would read it, as far as the delete guard needs: commands,
// their words with quotes removed, and the text the shell runs again from inside a word, `$(...)`
// and backticks. A heredoc's body is no command: a quoted-delimiter body is literal, an unquoted one
// gives only its `$(...)` and backticks. Plain strings only, so the hooks sandbox can import it.
// Not read (out of scope): `$'...'`, `${VAR:-...}`, a variable or `cd` carried along the line.

/** The commands of a line, each its words with quotes removed, and the texts of its command
 * substitutions, each a line the shell runs. */
export interface Split {
  readonly commands: string[][];
  readonly substituted: string[];
}

const SEPARATORS = new Set([";", "&", "|", "(", ")", "\n"]);

/** A heredoc whose body starts after the current line: its delimiter, whether it was quoted (a
 * literal body), and whether `<<-` strips leading tabs. */
interface Heredoc {
  readonly delimiter: string;
  readonly quoted: boolean;
  readonly tabs: boolean;
}

/** The heredoc whose `<<` or `<<-` stands at `i`, and the index of the last character of its
 * delimiter word. */
function heredocAt(text: string, i: number): { readonly doc: Heredoc; readonly last: number } {
  const tabs = text[i + 2] === "-";
  let at = tabs ? i + 3 : i + 2;
  while (text[at] === " " || text[at] === "\t") {
    at += 1;
  }
  let word = "";
  while (at < text.length && !` \t\n;&|()<>`.includes(text[at] ?? "")) {
    word += text[at] ?? "";
    at += 1;
  }
  const delimiter = word.replaceAll(/['"\\]/g, "");
  return { doc: { delimiter, quoted: delimiter !== word, tabs }, last: at - 1 };
}

/** The body of a heredoc whose operator's line ends at `newline`: where it starts and ends, and the
 * index of the newline closing its delimiter line (the text's end when none closes it). */
function bodyAfter(
  text: string,
  newline: number,
  doc: Heredoc,
): { readonly start: number; readonly end: number; readonly after: number } {
  const start = newline + 1;
  let line = start;
  while (line < text.length) {
    const stop = text.indexOf("\n", line);
    const lineEnd = stop < 0 ? text.length : stop;
    const content = text.slice(line, lineEnd);
    if ((doc.tabs ? content.replace(/^\t+/, "") : content) === doc.delimiter) {
      return { start, end: line, after: lineEnd };
    }
    line = lineEnd + 1;
  }
  return { start, end: text.length, after: text.length };
}

/** Past the bodies of the heredocs a line opened, from the newline that ends it; the index of the
 * last newline read. */
function pastBodies(text: string, newline: number, docs: readonly Heredoc[]): number {
  let at = newline;
  for (const doc of docs) {
    at = bodyAfter(text, at, doc).after;
  }
  return at;
}

/** Whether a `<<` at `i` opens a heredoc, not a `<<<` here-string. */
const opensHeredoc = (text: string, i: number): boolean =>
  text[i] === "<" && text[i + 1] === "<" && text[i + 2] !== "<";

/** The index past what a paren count skips at `i` (a quoted text, a heredoc operator, the bodies
 * of the heredocs a line opened), or null when the character there counts. */
function skipped(text: string, i: number, docs: Heredoc[]): number | null {
  const c = text[i] ?? "";
  if (c === "'" || c === '"') {
    const end = text.indexOf(c, i + 1);
    return end < 0 ? text.length : end;
  }
  if (opensHeredoc(text, i)) {
    const { doc, last } = heredocAt(text, i);
    docs.push(doc);
    return last;
  }
  return c === "\n" && docs.length > 0 ? pastBodies(text, i, docs.splice(0)) - 1 : null;
}

/** The index of the `)` closing a `$(` whose body starts at `from`, skipping quoted text and
 * heredoc bodies; the text's end when there is none. */
function closingParen(text: string, from: number): number {
  let depth = 1;
  const docs: Heredoc[] = [];
  for (let i = from; i < text.length; i += 1) {
    const c = text[i] ?? "";
    const past = skipped(text, i, docs);
    if (past !== null) {
      i = past;
    } else if (c === "(") {
      depth += 1;
    } else if (c === ")") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return text.length;
}

/** Where the substitution starting at `i` (`$(` or a backtick) ends, and its body. */
function substitutionAt(text: string, i: number): { readonly body: string; readonly end: number } {
  const backtick = text[i] === "`";
  const from = backtick ? i + 1 : i + 2;
  const found = backtick ? text.indexOf("`", from) : closingParen(text, from);
  const end = found < 0 ? text.length : found;
  return { body: text.slice(from, end), end };
}

/** The `$(...)` and backtick bodies of an unquoted heredoc body, which the shell expands but does
 * not run itself. */
function substitutionsIn(text: string): string[] {
  const found: string[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if ((text[i] === "$" && text[i + 1] === "(") || text[i] === "`") {
      const { body, end } = substitutionAt(text, i);
      found.push(body);
      i = end;
    }
  }
  return found;
}

class Splitter {
  readonly commands: string[][] = [[]];
  readonly substituted: string[] = [];
  private word: string | null = null;
  private quote: "'" | '"' | null = null;
  private readonly heredocs: Heredoc[] = [];

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

  private endCommand(): void {
    this.endWord();
    this.commands.push([]);
  }

  /** A `$(...)` or backtick in a word, quoted or not: its body is a line of its own; the index of
   * its last character. */
  private substitution(i: number): number {
    const { body, end } = substitutionAt(this.line, i);
    this.substituted.push(body);
    this.add("");
    return end;
  }

  /** One character inside quotes; the index of the last one it read. */
  private inQuote(i: number): number {
    const c = this.line[i] ?? "";
    if (c === this.quote) {
      this.quote = null;
      return i;
    }
    if (this.quote === '"' && ((c === "$" && this.line[i + 1] === "(") || c === "`")) {
      return this.substitution(i);
    }
    const escaped = this.quote === '"' && c === "\\" && i + 1 < this.line.length;
    this.add(escaped ? (this.line[i + 1] ?? "") : c);
    return escaped ? i + 1 : i;
  }

  /** One character outside quotes; the index of the last one it read. */
  private plain(i: number): number {
    const c = this.line[i] ?? "";
    const next = this.line[i + 1] ?? "";
    if (c === "'" || c === '"') {
      this.quote = c;
      this.add("");
    } else if (c === "\\" && i + 1 < this.line.length) {
      this.add(next);
      return i + 1;
    } else if (c === " " || c === "\t") {
      this.endWord();
    } else if ((c === "$" && next === "(") || c === "`") {
      return this.substitution(i);
    } else if (c === "<" && next === "<") {
      return this.heredoc(i);
    } else if (c === ">" && next === "|") {
      this.add(">|");
      return i + 1;
    } else if (c === "\n") {
      this.endCommand();
      return this.heredocBodies(i);
    } else if (SEPARATORS.has(c)) {
      this.endCommand();
    } else {
      this.add(c);
    }
    return i;
  }

  /** `<<<` is a here-string, an ordinary word; `<<` or `<<-` names a heredoc delimiter. */
  private heredoc(i: number): number {
    if (!opensHeredoc(this.line, i)) {
      this.add("<<<");
      return i + 2;
    }
    this.endWord();
    const { doc, last } = heredocAt(this.line, i);
    this.heredocs.push(doc);
    return last;
  }

  /** At the end of a line, the bodies of its heredocs: skipped, or read for substitutions; the
   * index of the last character of the last delimiter line. */
  private heredocBodies(newline: number): number {
    let at = newline;
    for (const doc of this.heredocs.splice(0)) {
      const body = bodyAfter(this.line, at, doc);
      if (!doc.quoted) {
        this.substituted.push(...substitutionsIn(this.line.slice(body.start, body.end)));
      }
      at = body.after;
    }
    return at === newline ? newline : at - 1;
  }
}

/** Splits `line` into commands and words, with the substitutions it runs. */
export const splitLine = (line: string): Split => new Splitter(line).run();
