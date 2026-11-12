// The rules of feedback as data (design.md decision 12): the values its labels take, the sections
// of the repository's template `.github/ISSUE_TEMPLATE/feedback.yml`, and the private data a body
// must not carry, because feedback lands on a public repository.
import { hostname, userInfo } from "node:os";
import { looksLikeSecret } from "../../../lib/secret-shapes.ts";

export const KINDS = ["tool-broken", "tool-missing", "wrong-output", "guidance", "agent-mistake"];
export const FROM = ["user", "main-agent", "subagent"];
/** An area that is no plugin: the marketplace as a whole. */
export const MARKETPLACE = "marketplace";

/** The template's sections, each a `## ` heading, in its order; a body holds these and no other. */
const SECTIONS = ["What happened", "Where", "How to reproduce", "Expected behaviour"];

/** The labels a feedback carries: `feedback` names its kind, the rest say what, where and who. */
export function labelsOf(area: string, kind: string, from: string): string[] {
  return ["feedback", `area:${area}`, `kind:${kind}`, `from:${from}`];
}

/** What is wrong with the body's sections: one missing, or one the template does not have. */
export function sectionsWrong(body: string): string | null {
  const headings = body
    .split("\n")
    .flatMap((line) => (line.startsWith("## ") ? [line.slice(3).trim()] : []));
  const other = headings.find((heading) => !SECTIONS.includes(heading));
  if (other !== undefined) {
    return `the body has a section the template does not: ## ${other}`;
  }
  const missing = SECTIONS.find((section) => !headings.includes(section));
  return missing === undefined ? null : `the body lacks the section ## ${missing}`;
}

/** Where a home directory starts on Linux, macOS and Windows. */
const HOMES = ["/home/", "/Users/", ":\\Users\\"];

/** A word with an @ and a dot after it: an address. */
function isEmail(word: string): boolean {
  const at = word.indexOf("@");
  return at > 0 && word.indexOf(".", at) > at + 1;
}

/** The kind of private data a line carries, or null. */
function privateIn(line: string, login: string, host: string): string | null {
  if (HOMES.some((home) => line.includes(home))) {
    return "home path";
  }
  if (line.split(/\s/).some((word) => isEmail(word))) {
    return "email";
  }
  const words = line.split(/[^\w.-]+/);
  if (login !== "" && words.includes(login)) {
    return "login";
  }
  if (host !== "" && words.includes(host)) {
    return "hostname";
  }
  return looksLikeSecret(line) === null ? null : "secret";
}

/** The first private data in the text, named by its kind and line, never by the text itself. */
export function privateData(text: string): string | null {
  const [login, host] = [userInfo().username, hostname()];
  const lines = text.split("\n");
  for (const [at, line] of lines.entries()) {
    const kind = privateIn(line, login, host);
    if (kind !== null) {
      return `${kind} on line ${at + 1}`;
    }
  }
  return null;
}
