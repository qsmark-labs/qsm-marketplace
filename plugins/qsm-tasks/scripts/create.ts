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
import { refuse, type Result } from "../lib/failure.ts";
import { changeLabel, priorityOf } from "../lib/flow.ts";
import { card, file, label, setPriority } from "../lib/github/board.ts";
import type { Run } from "../lib/github/gh.ts";
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

async function readText(path: string | undefined): Promise<Result<string>> {
  if (path === undefined) {
    return { ok: true, value: "" };
  }
  const text = Bun.file(path);
  return (await text.exists())
    ? { ok: true, value: await text.text() }
    : refuse("missing", "no-file", `no file ${path}`);
}

/** A Feature at Todo, its intent as the body; --spec binds it to its change. */
export async function feature(call: Call, { run, target }: At): Promise<Outcome> {
  const intent = await readText(requiredString(call, "intent"));
  if (!intent.ok) {
    return intent.outcome;
  }
  const spec = optionalString(call, "spec");
  const labels = spec === undefined ? [] : [changeLabel(spec)];
  for (const name of labels) {
    const made = await label(run, target, name);
    if (!made.ok) {
      return made.outcome;
    }
  }
  const title = requiredString(call, "goal");
  const flags = labels.flatMap((name) => ["--label", name]);
  const filed = await file(run, target, { kind: "feature", title, body: intent.value, flags });
  return filed.ok ? ok({ number: filed.value }, `#${filed.value} filed: ${title}`) : filed.outcome;
}

const DONE: Result<null> = { ok: true, value: null };

/** The feature a task goes under, when it names one: a feature, and open. */
async function parentOf(
  run: Run,
  target: Target,
  number: number | undefined,
): Promise<Result<null>> {
  const parent = number === undefined ? null : await card(run, target, number);
  if (parent === null || !parent.ok) {
    return parent ?? DONE;
  }
  if (parent.value.kind !== "feature") {
    return refuse("blocked", "wrong-kind", `#${String(number)} is not a feature`);
  }
  return parent.value.open
    ? DONE
    : refuse("blocked", "wrong-status", `#${String(number)} is closed`);
}

/** gh's flags for a task's labels, parent and the task it comes after. */
function taskFlags(call: Call): string[] {
  const under = optionalNumber(call, "feature");
  const after = optionalNumber(call, "after");
  return [
    ...stringList(call, "label").flatMap((name) => ["--label", name]),
    ...(under === undefined ? [] : ["--parent", String(under)]),
    ...(after === undefined ? [] : ["--blocked-by", String(after)]),
  ];
}

/** Sets the new task's Priority on its card, when the call names one. */
async function prioritize(
  run: Run,
  target: Target,
  number: number,
  value: string | undefined,
): Promise<Result<null>> {
  const at = value === undefined ? null : await card(run, target, number);
  return at === null || value === undefined
    ? DONE
    : at.ok
      ? setPriority(run, target, at.value, value)
      : at;
}

/** A Task, under --feature, after --after, with --priority, --body-file and --label. */
export async function add(call: Call, { run, target }: At): Promise<Outcome> {
  const parent = await parentOf(run, target, optionalNumber(call, "feature"));
  if (!parent.ok) {
    return parent.outcome;
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
  const set = await prioritize(run, target, filed.value, optionalString(call, "priority"));
  return set.ok ? ok({ number: filed.value }, `#${filed.value} filed: ${title}`) : set.outcome;
}
