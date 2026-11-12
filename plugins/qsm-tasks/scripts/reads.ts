// ready and list: each read is one query, and prints rows an agent reads without parsing.

import { type Call, flagArg, optionalNumber, optionalString } from "../../../lib/cli-base.ts";
import { type Outcome, ok } from "../../../lib/outcome.ts";
import { changeLabel, DEFERRED, priorityRank, STATUS } from "../lib/flow.ts";
import type { Run } from "../lib/github/gh.ts";
import { type Item, search } from "../lib/github/items.ts";
import type { Target } from "../lib/github/target.ts";

interface At {
  readonly run: Run;
  readonly target: Target;
}

/** `#<n> [<Status>] <title>` with its priority, assignees and open blockers. */
function row(item: Item): string {
  const blocked = item.blockers.map((n) => `#${n}`).join(", ");
  return [
    `#${item.number} [${item.status ?? "not on the board"}] ${item.title}`,
    ...(item.priority === null ? [] : [item.priority]),
    ...item.assignees.map((login) => `@${login}`),
    ...(blocked === "" ? [] : [`blocked by ${blocked}`]),
  ].join("  ");
}

function rows(items: readonly Item[]): Outcome {
  return ok({ items }, items.length === 0 ? "none" : items.map(row).join("\n"));
}

/** By Priority, P0 first and none last, then by number. */
function byRank(a: Item, b: Item): number {
  return priorityRank(a.priority) - priorityRank(b.priority) || a.number - b.number;
}

/** What `ready` lists in each mode: the work to take, or with --qa the features to test. */
const READY = {
  work: { kind: "task", status: STATUS.todo, unblocked: true, without: DEFERRED },
  qa: { kind: "feature", status: STATUS.readyForTest, unblocked: false, without: undefined },
} as const;

/** Todo tasks and bugs nothing open blocks, not deferred; with --qa, features at Ready For Test. */
export async function ready(call: Call, { run, target }: At): Promise<Outcome> {
  const mode = READY[flagArg(call, "qa") ? "qa" : "work"];
  const feature = optionalNumber(call, "feature");
  const filter = { kind: mode.kind, open: true, feature, without: mode.without } as const;
  const found = await search(run, target, filter);
  if (!found.ok) {
    return found.outcome;
  }
  const picked = found.value.filter(
    (i) => i.status === mode.status && (!mode.unblocked || i.blockers.length === 0),
  );
  return rows(picked.toSorted(byRank));
}

/** A --spec id that cannot be a label is a wrong call, refused before any gh call. */
export function checkSpec(call: Call): void {
  const spec = optionalString(call, "spec");
  if (spec !== undefined) {
    changeLabel(spec);
  }
}

/** The open issues; a feature's sub-issues or a change's feature are read whole, open and closed. */
export async function list(call: Call, { run, target }: At): Promise<Outcome> {
  const feature = optionalNumber(call, "feature");
  const spec = optionalString(call, "spec");
  const label = spec === undefined ? undefined : changeLabel(spec);
  const whole = feature !== undefined || spec !== undefined;
  const found = await search(run, target, whole ? { feature, label } : { open: true });
  return found.ok ? rows(found.value.toSorted((a, b) => a.number - b.number)) : found.outcome;
}
