// setup creates what doctor would fail that the API can make, then prints doctor's lines: a field
// with its options and definitions, an option, a label. It never renames or deletes, so a second
// run creates nothing and says so.

import type { Call } from "../../../lib/cli-base.ts";
import type { Outcome } from "../../../lib/outcome.ts";
import type { Run } from "../lib/github/gh.ts";
import { checks, health } from "../lib/github/health.ts";
import { changes } from "../lib/github/setup.ts";
import type { Target } from "../lib/github/target.ts";
import { verdict } from "./doctor.ts";

export async function setup(
  _call: Call,
  { run, target }: { run: Run; target: Target },
): Promise<Outcome> {
  const planned = await changes(run, target);
  if (!planned.ok) {
    return planned.outcome;
  }
  for (const change of planned.value) {
    const made = await change.make();
    if (!made.ok) {
      return made.outcome;
    }
  }
  const at = await health(run, target);
  if (!at.ok) {
    return at.outcome;
  }
  const said =
    planned.value.length === 0 ? ["nothing to create"] : planned.value.map((c) => c.said);
  const head = `setup on ${target.repo}, board ${target.board.owner}/${target.board.number}`;
  return verdict([head, ...said].join("\n"), checks(at.value));
}
