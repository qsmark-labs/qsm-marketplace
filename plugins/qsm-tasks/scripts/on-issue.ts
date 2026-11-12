// A verb on one issue, the shape the moves and the edits share: read its card, check its guard,
// then make its writes in order up to the first refusal, each idempotent, so a rerun finishes it.

import { type Call, requiredNumber } from "../../../lib/cli-base.ts";
import { type Outcome, ok } from "../../../lib/outcome.ts";
import type { Result } from "../lib/failure.ts";
import { type Card, card } from "../lib/github/board.ts";
import type { Run } from "../lib/github/gh.ts";
import type { Target } from "../lib/github/target.ts";

export interface At {
  readonly run: Run;
  readonly target: Target;
}

/** One write. */
export type Write = () => Promise<Result<unknown>>;

/** What a verb will do once its guard holds: its writes, and the line it prints after them. */
export interface Plan {
  readonly steps: readonly Write[];
  readonly said: string;
}

/** The verb on the issue its call names: its plan, or its guard's refusal, before any write. */
export function onIssue(
  plan: (call: Call, on: At, at: Card) => Result<Plan>,
): (call: Call, on: At) => Promise<Outcome> {
  return async (call, on) => {
    const found = await card(on.run, on.target, requiredNumber(call, "number"));
    const planned = found.ok ? plan(call, on, found.value) : found;
    if (!planned.ok) {
      return planned.outcome;
    }
    for (const step of planned.value.steps) {
      const done = await step();
      if (!done.ok) {
        return done.outcome;
      }
    }
    return ok({ number: requiredNumber(call, "number") }, planned.value.said);
  };
}
