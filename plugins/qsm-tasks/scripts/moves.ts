// The moves of a task and a feature, one engine for all: read the card, check the move's guard in
// lib/flow.ts, then make the writes, which are idempotent, so running a verb again finishes it.

import {
  type Call,
  flagArg,
  optionalNumber,
  optionalString,
  requiredNumber,
} from "../../../lib/cli-base.ts";
import { type Outcome, UsageError } from "../../../lib/outcome.ts";
import { DEFERRED, moveOf } from "../lib/flow.ts";
import { type Card, comment, edit, reopen as reopenIssue, setField } from "../lib/github/board.ts";
import { readyPull } from "../lib/github/pulls.ts";
import { type At, onIssue, type Write } from "./on-issue.ts";

/** A move: card read, guard checked, then `around`'s writes before and after the Status, up to the
 * first refusal; a Status at its target is not written again. It prints `#<n> <from> -> <to>`. */
function moving(
  verb: string,
  around: (call: Call, on: At, at: Card) => { before?: Write[]; after?: Write[] } = () => ({}),
): (call: Call, on: At) => Promise<Outcome> {
  return onIssue((call, on, at) => {
    const from = at.status;
    const move = moveOf(verb, at);
    if (!move.ok) {
      return move;
    }
    const { to } = move.value;
    const { before = [], after = [] } = around(call, on, at);
    const status: Write[] =
      from === to && at.cardId !== null
        ? []
        : [() => setField(on.run, on.target, at, "Status", to)];
    const said = `#${at.number} ${from ?? "no Status"} -> ${to}`;
    return { ok: true, value: { steps: [...before, ...status, ...after], said } };
  });
}

/** Todo, unassigned or the caller's: In Dev, assigned to the caller, on the board. */
export const claim = moving("claim", (_call, { run, target }, at) => ({
  before: at.assignees.includes(at.caller)
    ? []
    : [() => edit(run, target, at.number, ["--add-assignee", "@me"])],
}));

/** Back to Todo and unassigned; --until defers it, and without it a deferred task comes back.
 * Assignee and label first, comment last: whatever a refusal leaves, a rerun passes and finishes. */
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

/** In Dev, Agent Review or Human Review: Agent Review. */
export const review = moving("review");

/** Agent Review: Ready For Human, once the PR --pr names is the task's ready one; the read of it is
 * the first step, so a PR that is not ready ends the move before any write. */
const handOver = moving("human", (call, { run, target }, at) => {
  const [pr, { number, parent }] = [requiredNumber(call, "pr"), at];
  // the move's guard refused a task under no feature, so parent is a number here
  const read = parent === null ? [] : [() => readyPull(run, target, pr, number, parent)];
  return { before: read };
});

/** Ready For Human, once the owner started his review: Human Review. */
const ownerStarted = moving("human --started");

export function human(call: Call, on: At): Promise<Outcome> {
  return flagArg(call, "started") ? ownerStarted(call, on) : handOver(call, on);
}

/** --pr names the pull request a hand-over reads; --started reads none. */
export function checkHuman(call: Call): void {
  const started = flagArg(call, "started");
  const named = optionalNumber(call, "pr") !== undefined;
  if (started === named) {
    throw new UsageError("human: --pr <m> to hand a task over, or --started, not both");
  }
}

/** A feature at In Dev, Ready For Test or Blocked: back to Todo for planning. */
export const plan = moving("plan");

/** A feature at Ready For Test whose sub-issues are all closed: In Test. */
export const qa = moving("qa");

/** A closed task, bug or feedback whose parent is open: open again, at Todo. */
export const reopen = moving("reopen", (_call, { run, target }, at) => ({
  before: [() => reopenIssue(run, target, at.number)],
}));
