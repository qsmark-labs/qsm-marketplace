// The moves that take and give back a task: claim and unclaim. Each checks its guard in
// lib/flow.ts first and changes nothing when it fails; its writes are idempotent, so running it
// again finishes it.

import { type Call, optionalString, requiredNumber } from "../../../lib/cli-base.ts";
import { type Outcome, ok } from "../../../lib/outcome.ts";
import { refuse, type Result } from "../lib/failure.ts";
import { DEFERRED, moveOf, STATUS } from "../lib/flow.ts";
import { type Card, card, edit, setStatus } from "../lib/github/board.ts";
import type { Run } from "../lib/github/gh.ts";
import { comment } from "../lib/github/items.ts";
import type { Target } from "../lib/github/target.ts";

interface At {
  readonly run: Run;
  readonly target: Target;
}

/** A write: the Status line it prints, or null for one that prints nothing. */
type Write = () => Promise<Result<string | null>>;

/** Runs the writes in order, stops at the first refusal, and prints what they print. */
async function writes(number: number, steps: readonly Write[]): Promise<Outcome> {
  const lines: string[] = [];
  for (const step of steps) {
    const done = await step();
    if (!done.ok) {
      return done.outcome;
    }
    lines.push(...(done.value === null ? [] : [done.value]));
  }
  return ok({ number }, lines.join("\n"));
}

/** A move on one issue: its card read first, or the reason it could not be. */
function onCard(
  verb: (call: Call, on: At, at: Card) => Outcome | Promise<Outcome>,
): (call: Call, on: At) => Promise<Outcome> {
  return async (call, on) => {
    const found = await card(on.run, on.target, requiredNumber(call, "number"));
    return found.ok ? verb(call, on, found.value) : found.outcome;
  };
}

/** Todo, unassigned or the caller's: In Dev, assigned to the caller, on the board. */
export const claim = onCard((_call, { run, target }, at) => {
  // an issue the board has not added yet is at Todo once it is: claim adds it (design.md decision 9)
  const move = moveOf("claim", at.kind, at.cardId === null ? STATUS.todo : at.status);
  if (!move.ok) {
    return move.outcome;
  }
  const others = at.assignees.filter((login) => login !== at.caller);
  if (others.length > 0) {
    return refuse("blocked", "held", `#${at.number} is held by ${others.join(", ")}`).outcome;
  }
  const assign: Write = () => edit(run, target, at.number, ["--add-assignee", "@me"]);
  return writes(at.number, [
    ...(at.assignees.includes(at.caller) ? [] : [assign]),
    () => setStatus(run, target, at, move.value.to),
  ]);
});

/** A deferred task at Todo may only be brought back or deferred again. */
function unclaimable(at: Card): Result<null> {
  const move = moveOf("unclaim", at.kind, at.status);
  if (!move.ok) {
    return move;
  }
  return at.status === STATUS.todo && !at.labels.includes(DEFERRED)
    ? refuse(
        "blocked",
        "wrong-status",
        `unclaim needs Todo labelled ${DEFERRED}; #${at.number} is not`,
      )
    : { ok: true, value: null };
}

/** Back to Todo and unassigned; --until defers it, and without it a deferred task comes back. */
export const unclaim = onCard((call, { run, target }, at) => {
  const allowed = unclaimable(at);
  if (!allowed.ok) {
    return allowed.outcome;
  }
  const until = optionalString(call, "until");
  const toTodo: Write = () => setStatus(run, target, at, STATUS.todo);
  const release: Write = () =>
    edit(run, target, at.number, ["--remove-assignee", at.assignees.join(",")]);
  const defer: Write[] = [
    () => edit(run, target, at.number, ["--add-label", DEFERRED]),
    async () => {
      const posted = await comment(run, target, at.number, `Deferred until ${until}`);
      return posted.ok ? { ok: true, value: `#${at.number} deferred until ${until}` } : posted;
    },
  ];
  const bringBack: Write = () => edit(run, target, at.number, ["--remove-label", DEFERRED]);
  return writes(at.number, [
    ...(at.status === STATUS.todo ? [] : [toTodo]),
    ...(at.assignees.length === 0 ? [] : [release]),
    ...(until === undefined ? (at.labels.includes(DEFERRED) ? [bringBack] : []) : defer),
  ]);
});
