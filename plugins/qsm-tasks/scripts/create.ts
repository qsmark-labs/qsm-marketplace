// feature and add file the work: a Feature an agent creates when the owner asks in chat, and a
// Task under an open feature. The body goes to GitHub on stdin; a change id becomes its label.

import {
  type Call,
  optionalNumber,
  optionalString,
  requiredString,
  stringList,
} from "../../../lib/cli-base.ts";
import { type Outcome, ok } from "../../../lib/outcome.ts";
import { done, refuse, type Result } from "../lib/failure.ts";
import { readText } from "../lib/files.ts";
import { changeLabel, priorityOf } from "../lib/flow.ts";
import { card, file, hasOption, setField } from "../lib/github/board.ts";
import type { Run } from "../lib/github/gh.ts";
import { issue } from "../lib/github/items.ts";
import type { Target } from "../lib/github/target.ts";

interface At {
  readonly run: Run;
  readonly target: Target;
}

/** The checks a create makes before any gh call: the change id fits a label, the Priority is one. */
export function checkCreate(call: Call): void {
  const spec = optionalString(call, "spec");
  const priority = optionalString(call, "priority");
  if (spec !== undefined) {
    changeLabel(spec);
  }
  if (priority !== undefined) {
    priorityOf(priority);
  }
}

/** A Feature at Todo, its intent as the body; --spec binds it to its change by a label it makes. */
export async function feature(call: Call, { run, target }: At): Promise<Outcome> {
  const intent = await readText(requiredString(call, "intent"));
  if (!intent.ok) {
    return intent.outcome;
  }
  const spec = optionalString(call, "spec");
  const make = spec === undefined ? [] : [changeLabel(spec)];
  const title = requiredString(call, "goal");
  const filed = await file(run, target, {
    kind: "feature",
    title,
    body: intent.value,
    flags: [],
    make,
  });
  return filed.ok ? ok({ number: filed.value }, `#${filed.value} filed: ${title}`) : filed.outcome;
}

/** The feature a task goes under: a feature, and open. */
async function parentOf(run: Run, target: Target, number: number): Promise<Result<null>> {
  const parent = await issue(run, target, number, false);
  if (!parent.ok) {
    return parent;
  }
  if (parent.value.kind !== "feature") {
    return refuse("blocked", "wrong-kind", `#${number} is not a feature`);
  }
  return parent.value.open ? done : refuse("blocked", "wrong-status", `#${number} is closed`);
}

/** gh's flags for a task's labels, which must exist, its parent and the task it comes after. */
function taskFlags(call: Call): string[] {
  const under = optionalNumber(call, "feature");
  const after = optionalNumber(call, "after");
  return [
    ...stringList(call, "label").flatMap((name) => ["--label", name]),
    ...(under === undefined ? [] : ["--parent", String(under)]),
    ...(after === undefined ? [] : ["--blocked-by", String(after)]),
  ];
}

/** Sets the new task's Priority; the card read it needs for the card's id brings the field's ids. */
async function prioritize(
  run: Run,
  target: Target,
  number: number,
  value: string,
): Promise<Result<null>> {
  const at = await card(run, target, number);
  return at.ok ? setField(run, target, at.value, "Priority", value) : at;
}

/** A Task, under --feature, after --after, with --priority, --body-file and --label; the parent and
 * the Priority option are read first, so a refusal files nothing and a rerun no duplicate. */
export async function add(call: Call, { run, target }: At): Promise<Outcome> {
  const under = optionalNumber(call, "feature");
  const priority = optionalString(call, "priority");
  const parent = under === undefined ? done : await parentOf(run, target, under);
  if (!parent.ok) {
    return parent.outcome;
  }
  const can = priority === undefined ? done : await hasOption(run, target, "Priority", priority);
  if (!can.ok) {
    return can.outcome;
  }
  const body = await readText(optionalString(call, "bodyFile"));
  if (!body.ok) {
    return body.outcome;
  }
  const title = requiredString(call, "title");
  const filed = await file(run, target, {
    kind: "task",
    title,
    body: body.value,
    flags: taskFlags(call),
  });
  if (!filed.ok) {
    return filed.outcome;
  }
  const set = priority === undefined ? done : await prioritize(run, target, filed.value, priority);
  return set.ok ? ok({ number: filed.value }, `#${filed.value} filed: ${title}`) : set.outcome;
}
