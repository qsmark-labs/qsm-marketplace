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

/** What gh prints when `{owner}` or `{repo}` cannot be filled from the working directory. */
const NO_REPO = 'error parsing "';
const SCOPE_FIX = "gh auth refresh -s project";

function firstError(stdout: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stdout);
    const errors = isRecord(parsed) ? parsed.errors : undefined;
    const first: unknown = Array.isArray(errors) ? errors[0] : undefined;
    return isRecord(first) ? first : null;
  } catch {
    // gh printed no JSON: the failure is in its stderr
    return null;
  }
}

function failureOf(answer: GhAnswer): Result<never> {
  const error = firstError(answer.stdout);
  if (error === null) {
    const said = answer.stderr.trim();
    return said.startsWith(NO_REPO)
      ? refuse("missing", "no-repo", `gh found no GitHub repository here: ${said}`, "pass --repo")
      : refuse("failed", "refused", said === "" ? `gh exited ${answer.exit}` : said);
  }
  const message = typeof error.message === "string" ? error.message : JSON.stringify(error);
  if (error.type === "NOT_FOUND") {
    return refuse("failed", "not-found", message);
  }
  return error.type === "INSUFFICIENT_SCOPES"
    ? refuse("failed", "refused", message, SCOPE_FIX)
    : refuse("failed", "refused", message);
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
  const parsed: unknown = JSON.parse(answer.stdout);
  if (!isRecord(parsed) || !isRecord(parsed.data)) {
    throw new Error(`gh api graphql answered without data: ${answer.stdout.slice(0, 200)}`);
  }
  return { ok: true, value: parsed.data };
}
