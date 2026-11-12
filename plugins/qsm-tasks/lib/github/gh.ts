// The one door to GitHub: every call is `gh <args>` with an optional stdin, and every way gh
// fails becomes an outcome with its reason, carrying GitHub's own words.
import { onPath } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";

interface GhAnswer {
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
