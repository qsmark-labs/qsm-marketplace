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

/** gh, run in `cwd` when one is given, so `{owner}` and `{repo}` fill from that checkout. */
const runGh = async (args: readonly string[], stdin?: string, cwd?: string): Promise<GhAnswer> => {
  const proc = Bun.spawn(["gh", ...args], {
    stdin: stdin === undefined ? "ignore" : Buffer.from(stdin),
    stdout: "pipe",
    stderr: "pipe",
    ...(cwd === undefined ? {} : { cwd }),
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exit, stdout, stderr };
};

/** gh on PATH, or `missing` `no-gh`. */
export function connect(cwd?: string): Result<Run> {
  return onPath("gh")
    ? { ok: true, value: (args, stdin) => runGh(args, stdin, cwd) }
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
    ? refuse("missing", "no-repo", `gh found no GitHub repository here: ${said}`)
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
  return dataOf(await run(["api", "graphql", "-f", `query=${query}`, ...fields]));
}

/** A GraphQL write whose variables hold lists of objects, which gh's fields cannot spell: the
 * whole request goes to gh on stdin as JSON. */
export async function graphqlJson(
  run: Run,
  query: string,
  values: Readonly<Record<string, unknown>>,
): Promise<Result<Record<string, unknown>>> {
  return dataOf(
    await run(["api", "graphql", "--input", "-"], JSON.stringify({ query, variables: values })),
  );
}

/** GraphQL's `data` in gh's answer, or the failure in GitHub's words. */
function dataOf(answer: GhAnswer): Result<Record<string, unknown>> {
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

/** GraphQL variables as gh's pairs: a string verbatim (`-f`), a number or boolean typed (`-F`). */
export function variables(values: Readonly<Record<string, string | number | boolean>>): string[] {
  return Object.entries(values).flatMap(([k, v]) => [
    typeof v === "string" ? "-f" : "-F",
    `${k}=${v}`,
  ]);
}

/** A gh command that is not GraphQL: what it printed, or GitHub's refusal in gh's words. */
export async function gh(
  run: Run,
  args: readonly string[],
  stdin?: string,
): Promise<Result<string>> {
  const answer = await run(args, stdin);
  return answer.exit === 0 ? { ok: true, value: answer.stdout.trim() } : ghFailure(answer);
}
