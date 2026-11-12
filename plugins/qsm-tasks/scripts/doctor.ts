// doctor prints one line per check of the task tool on GitHub and exits by the worst: failed when
// any failed, partial when only manual ones remain, ok when every one is ok. It writes nothing.

import type { Call } from "../../../lib/cli-base.ts";
import { fail, type Outcome, ok } from "../../../lib/outcome.ts";
import type { Run } from "../lib/github/gh.ts";
import { type Check, checks, health } from "../lib/github/health.ts";
import type { Target } from "../lib/github/target.ts";

/** `ok`, `failed` or `manual`, the check, and what fixes it. */
function row(check: Check): string {
  const fix = check.status === "ok" || check.fix === undefined ? "" : `: ${check.fix}`;
  return `  ${check.status.padEnd(6)}  ${check.name}${fix}`;
}

/** The lines and the verdict of every check. */
export function verdict(head: string, list: readonly Check[]): Outcome {
  const message = [head, ...list.map(row)].join("\n");
  const data = { checks: list };
  if (list.some((c) => c.status === "failed")) {
    return fail("failed", message, data);
  }
  return list.some((c) => c.status === "manual")
    ? { code: "partial", message, data }
    : ok(data, message);
}

export async function doctor(
  _call: Call,
  { run, target }: { run: Run; target: Target },
): Promise<Outcome> {
  const at = await health(run, target);
  const head = `repository ${target.repo}, board ${target.board.owner}/${target.board.number}`;
  return at.ok ? verdict(head, checks(at.value)) : at.outcome;
}
