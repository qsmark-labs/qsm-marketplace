// doctor prints one line per check of the task tool on GitHub and exits by the worst: failed when
// any failed, partial when only manual ones remain, ok when every one is ok. It writes nothing.

import type { Call } from "../../../lib/cli-base.ts";
import type { Outcome } from "../../../lib/outcome.ts";
import type { Run } from "../lib/github/gh.ts";
import { checks, health, verdict } from "../lib/github/health.ts";
import type { Target } from "../lib/github/target.ts";

export async function doctor(
  _call: Call,
  { run, target }: { run: Run; target: Target },
): Promise<Outcome> {
  const at = await health(run, target);
  const head = `repository ${target.repo}, board ${target.board.owner}/${target.board.number}`;
  return at.ok ? verdict(head, checks(at.value)) : at.outcome;
}
