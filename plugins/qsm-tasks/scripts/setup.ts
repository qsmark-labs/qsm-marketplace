// setup creates what doctor would fail that the API can make, then prints doctor's lines: a field
// with its options and definitions, an option, a label. It never renames or deletes, so a second
// run creates nothing and says so.

import type { Call } from "../../../lib/cli-base.ts";
import type { Outcome } from "../../../lib/outcome.ts";
import { labels } from "../lib/github/board.ts";
import { graphqlJson, type Run } from "../lib/github/gh.ts";
import { checks, health, verdict } from "../lib/github/health.ts";
import { changes } from "../lib/github/setup.ts";
import type { Target } from "../lib/github/target.ts";

/** Reads the board, makes what it lacks, and judges it by a fresh read. */
export async function setup(
  _call: Call,
  { run, target }: { run: Run; target: Target },
): Promise<Outcome> {
  const before = await health(run, target);
  if (!before.ok) {
    return before.outcome;
  }
  const planned = changes(before.value, target.board.id);
  for (const change of planned) {
    const made =
      "label" in change
        ? await labels(run, target, [change.label])
        : await graphqlJson(run, change.query, change.values);
    if (!made.ok) {
      return made.outcome;
    }
  }
  const after = await health(run, target);
  if (!after.ok) {
    return after.outcome;
  }
  const said = planned.length === 0 ? ["nothing to create"] : planned.map((c) => c.said);
  const head = `setup on ${target.repo}, board ${target.board.owner}/${target.board.number}`;
  return verdict([head, ...said].join("\n"), checks(after.value));
}
