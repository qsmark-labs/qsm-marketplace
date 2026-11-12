// The moves of a task and a feature, one engine for all: read the card, check the move's guard in
// lib/flow.ts, then make the writes, which are idempotent, so running a verb again finishes it.

import { type Call, optionalString, requiredNumber } from "../../../lib/cli-base.ts";
import { type Outcome, ok } from "../../../lib/outcome.ts";
import type { Result } from "../lib/failure.ts";
import { DEFERRED, moveOf } from "../lib/flow.ts";
import { type Card, card, comment, edit, setStatus } from "../lib/github/board.ts";
import type { Run } from "../lib/github/gh.ts";
import type { Target } from "../lib/github/target.ts";

interface At {
  readonly run: Run;
  readonly target: Target;
}

type Write = () => Promise<Result<unknown>>;

/** A move: the card read, the guard checked, then the writes `around` names before and after the
 * Status, in order up to the first refusal; it prints `#<n> <from> -> <to>`. A Status already at
 * its target is not written again, so a rerun after a refusal makes only what is left. */
function moving(
  verb: string,
  around: (call: Call, on: At, at: Card) => { before?: Write[]; after?: Write[] } = () => ({}),
): (call: Call, on: At) => Promise<Outcome> {
  return async (call, on) => {
    const found = await card(on.run, on.target, requiredNumber(call, "number"));
    if (!found.ok) {
      return found.outcome;
    }
    const at = found.value;
    const from = at.status;
    const move = moveOf(verb, at);
    if (!move.ok) {
      return move.outcome;
    }
    const { to } = move.value;
    const { before = [], after = [] } = around(call, on, at);
    const status: Write[] =
      from === to && at.cardId !== null ? [] : [() => setStatus(on.run, on.target, at, to)];
    for (const write of [...before, ...status, ...after]) {
      const done = await write();
      if (!done.ok) {
        return done.outcome;
      }
    }
    return ok({ number: at.number }, `#${at.number} ${from ?? "no Status"} -> ${to}`);
  };
}

/** Todo, unassigned or the caller's: In Dev, assigned to the caller, on the board. */
export const claim = moving("claim", (_call, { run, target }, at) => ({
  before: at.assignees.includes(at.caller)
    ? []
    : [() => edit(run, target, at.number, ["--add-assignee", "@me"])],
}));

/** Back to Todo and unassigned; --until defers it, and without it a deferred task comes back. The
 * assignee and the label go first and the comment last, so a rerun after a refusal finishes it:
 * a task labelled deferred at Todo still passes the guard. */
export const unclaim = moving("unclaim", (call, { run, target }, at) => {
  const until = optionalString(call, "until");
  const deferring = until !== undefined;
  const bringingBack = !deferring && at.labels.includes(DEFERRED);
  const flags = [
    ...(at.assignees.length === 0 ? [] : ["--remove-assignee", at.assignees.join(",")]),
    ...(deferring ? ["--add-label", DEFERRED] : []),
    ...(bringingBack ? ["--remove-label", DEFERRED] : []),
  ];
  const release: Write[] = flags.length === 0 ? [] : [() => edit(run, target, at.number, flags)];
  const note: Write[] = deferring
    ? [() => comment(run, target, at.number, `Deferred until ${until}`)]
    : [];
  return { before: release, after: note };
});
