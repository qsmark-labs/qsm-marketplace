// The writes on an issue; lib/github/items.ts only reads.
import { refuse, type Result } from "../failure.ts";
import type { Run } from "./gh.ts";
import type { Target } from "./target.ts";

/** One comment on an issue, its text on stdin so quotes and newlines reach GitHub unchanged. */
export async function comment(
  run: Run,
  target: Target,
  number: number,
  body: string,
): Promise<Result<string>> {
  const args = ["issue", "comment", String(number), "--repo", target.repo, "--body-file", "-"];
  const answer = await run(args, body);
  const said = answer.stderr.trim();
  if (answer.exit !== 0) {
    return refuse("failed", "refused", said === "" ? `gh exited ${answer.exit}` : said);
  }
  return { ok: true, value: answer.stdout.trim() };
}
