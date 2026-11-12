// The writes on an issue; lib/github/items.ts only reads.
import type { Result } from "../failure.ts";
import { gh, type Run } from "./gh.ts";
import type { Target } from "./target.ts";

/** One comment on an issue, its text on stdin so quotes and newlines reach GitHub unchanged. */
export function comment(
  run: Run,
  target: Target,
  number: number,
  body: string,
): Promise<Result<string>> {
  return gh(
    run,
    ["issue", "comment", String(number), "--repo", target.repo, "--body-file", "-"],
    body,
  );
}
