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

/** The index of the `)` closing a `$(` whose body starts at `from`, skipping quoted text; the
 * line's end when there is none. */
function closingParen(text: string, from: number): number {
  let depth = 1;
  for (let i = from; i < text.length; i += 1) {
    const c = text[i] ?? "";
    if (c === "'" || c === '"') {
      const end = text.indexOf(c, i + 1);
      i = end < 0 ? text.length : end;
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

/** The `$(...)` and backtick bodies of a text the shell expands but does not run itself: a double
 * quoted word, an unquoted heredoc. */
function substitutionsIn(text: string): string[] {
  const found: string[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "$" && text[i + 1] === "(") {
      const end = closingParen(text, i + 2);
      found.push(text.slice(i + 2, end));
      i = end;
    } else if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      found.push(text.slice(i + 1, end < 0 ? text.length : end));
      i = end < 0 ? text.length : end;
    }
  }
  return found;
}

/** A heredoc whose body starts after the current line: its delimiter, whether it was quoted (a
 * literal body), and whether `<<-` strips leading tabs. */
interface Heredoc {
  readonly delimiter: string;
  readonly quoted: boolean;
  readonly tabs: boolean;
}

class Splitter {
  readonly commands: string[][] = [[]];
  readonly substituted: string[] = [];
  private word: string | null = null;
  private quote: "'" | '"' | null = null;
  private quoted = "";
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

  /** One character inside quotes; the index of the last one it read. */
  private inQuote(i: number): number {
    const c = this.line[i] ?? "";
    if (c === this.quote) {
      if (this.quote === '"') {
        this.substituted.push(...substitutionsIn(this.quoted));
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
    const next = this.line[i + 1] ?? "";
    if (c === "'" || c === '"') {
      this.quote = c;
      this.quoted = "";
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

  /** A `$(...)` or backtick in a word: its body is a line of its own. */
  private substitution(i: number): number {
    const backtick = this.line[i] === "`";
    const from = backtick ? i + 1 : i + 2;
    const found = backtick ? this.line.indexOf("`", from) : closingParen(this.line, from);
    const end = found < 0 ? this.line.length : found;
    this.substituted.push(this.line.slice(from, end));
    this.add("");
    return end;
  }

  /** `<<<` is a here-string, an ordinary word; `<<` or `<<-` names a heredoc delimiter. */
  private heredoc(i: number): number {
    if (this.line[i + 2] === "<") {
      this.add("<<<");
      return i + 2;
    }
    this.endWord();
    const tabs = this.line[i + 2] === "-";
    let at = tabs ? i + 3 : i + 2;
    while (this.line[at] === " " || this.line[at] === "\t") {
      at += 1;
    }
    let delimiter = "";
    let quoted = false;
    while (at < this.line.length && !` \t\n;&|()<>`.includes(this.line[at] ?? "")) {
      const c = this.line[at] ?? "";
      if (c === "'" || c === '"' || c === "\\") {
        quoted = true;
      } else {
        delimiter += c;
      }
      at += 1;
    }
    this.heredocs.push({ delimiter, quoted, tabs });
    return at - 1;
  }

  /** At the end of a line, the bodies of its heredocs: skipped, or read for substitutions; the
   * index of the last character of the last delimiter line. */
  private heredocBodies(newline: number): number {
    let at = newline;
    for (const doc of this.heredocs.splice(0)) {
      const start = at + 1;
      let line = start;
      let end = this.line.length;
      while (line < this.line.length) {
        const stop = this.line.indexOf("\n", line);
        const lineEnd = stop < 0 ? this.line.length : stop;
        const text = this.line.slice(line, lineEnd);
        if ((doc.tabs ? text.replace(/^\t+/, "") : text) === doc.delimiter) {
          end = line;
          at = lineEnd;
          break;
        }
        line = lineEnd + 1;
        at = this.line.length;
      }
      if (!doc.quoted) {
        this.substituted.push(...substitutionsIn(this.line.slice(start, end)));
      }
    }
    return at === newline ? newline : at - 1;
  }
}

/** Splits `line` into commands and words, with the substitutions it runs. */
export const splitLine = (line: string): Split => new Splitter(line).run();
