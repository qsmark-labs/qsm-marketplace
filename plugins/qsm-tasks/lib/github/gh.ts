// The one door to GitHub: every call is `gh <args>` with an optional stdin, and every way gh
// fails becomes an outcome with its reason, carrying GitHub's own words.
import { isRecord, onPath } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";

export interface GhAnswer {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** One call of gh; a test hands a recording fake where a run hands the real gh. */
export type Run = (args: readonly string[], stdin?: string) => Promise<GhAnswer>;

const runGh: Run = async (args, stdin) => {
  const proc = Bun.spawn(["gh", ...args], {
    stdin: stdin === undefined ? "ignore" : Buffer.from(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exit, stdout, stderr };
};

/** gh on PATH, or `missing` `no-gh`. */
export function connect(): Result<Run> {
  return onPath("gh")
    ? { ok: true, value: runGh }
    : refuse("missing", "no-gh", "gh is not on PATH", "install the GitHub CLI, then gh auth login");
}

// gh 2.103.3 prints only this on stderr, with no code and nothing on stdout, when it cannot fill
// `{owner}` or `{repo}` from the working directory; the text is the one thing to match.
const NO_REPO = 'error parsing "';
const SCOPE_FIX = "gh auth refresh -s project";

/** What gh printed on stdout as JSON; anything else is a failure that shows what it was. */
function parseJson(stdout: string): Result<unknown> {
  try {
    const parsed: unknown = JSON.parse(stdout);
    return { ok: true, value: parsed };
  } catch {
    return refuse("failed", "refused", `gh answered with no JSON: ${stdout.trim().slice(0, 200)}`);
  }
}

/** gh failed before GitHub answered: its own words are on stderr. */
function ghFailure(answer: GhAnswer): Result<never> {
  const said = answer.stderr.trim();
  return said.startsWith(NO_REPO)
    ? refuse("missing", "no-repo", `gh found no GitHub repository here: ${said}`, "pass --repo")
    : refuse("failed", "refused", said === "" ? `gh exited ${answer.exit}` : said);
}

/** A failed call: gh's own failure when it printed nothing on stdout, else GitHub's first error. */
function failureOf(answer: GhAnswer): Result<never> {
  if (answer.stdout.trim() === "") {
    return ghFailure(answer);
  }
  const parsed = parseJson(answer.stdout);
  if (!parsed.ok) {
    return parsed;
  }
  const errors = isRecord(parsed.value) ? parsed.value.errors : undefined;
  const error: unknown = Array.isArray(errors) ? errors[0] : undefined;
  if (!isRecord(error) || typeof error.message !== "string") {
    return refuse("failed", "refused", `gh exited ${answer.exit}: ${answer.stdout.slice(0, 200)}`);
  }
  const reason = error.type === "NOT_FOUND" ? "not-found" : "refused";
  const next = error.type === "INSUFFICIENT_SCOPES" ? SCOPE_FIX : undefined;
  return refuse("failed", reason, error.message, next);
}

/** One GraphQL query; `fields` are gh's own `-f`/`-F` pairs. Its `data`, or the failure. */
export async function graphql(
  run: Run,
  query: string,
  fields: readonly string[],
): Promise<Result<Record<string, unknown>>> {
  const answer = await run(["api", "graphql", "-f", `query=${query}`, ...fields]);
  if (answer.exit !== 0) {
    return failureOf(answer);
  }
  const parsed = parseJson(answer.stdout);
  if (!parsed.ok) {
    return parsed;
  }
  return isRecord(parsed.value) && isRecord(parsed.value.data)
    ? { ok: true, value: parsed.value.data }
    : refuse("failed", "refused", `gh answered without data: ${answer.stdout.slice(0, 200)}`);
}
