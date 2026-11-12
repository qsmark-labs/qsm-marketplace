// edit and close correct, bind and cancel the work: edit changes what a flag names, close ends an
// issue with its reason as a comment, and neither writes a Status.

import {
  type Call,
  flagArg,
  optionalNumber,
  optionalString,
  requiredString,
} from "../../../lib/cli-base.ts";
import { UsageError } from "../../../lib/outcome.ts";
import { done, refuse, type Result } from "../lib/failure.ts";
import { readText } from "../lib/files.ts";
import { changeLabel } from "../lib/flow.ts";
import {
  type Card,
  close as closeIssue,
  comment,
  edit as editIssue,
  setField,
} from "../lib/github/board.ts";
import type { Run } from "../lib/github/gh.ts";
import type { Target } from "../lib/github/target.ts";
import { checkCreate } from "./create.ts";
import { onIssue, type Plan, type Step } from "./on-issue.ts";

/** gh's flags for what edit changes on the issue itself; GitHub refuses a cycle in its own words. */
function editFlags(call: Call): string[] {
  const pairs: [string, string | number | undefined][] = [
    ["--title", optionalString(call, "title")],
    ["--add-assignee", optionalString(call, "assignee")],
    ["--parent", optionalNumber(call, "feature")],
    ["--add-blocked-by", optionalNumber(call, "after")],
    ["--remove-blocked-by", optionalNumber(call, "unblock")],
  ];
  return pairs.flatMap(([flag, value]) => (value === undefined ? [] : [flag, String(value)]));
}

/** The args that name the issue and its board; every other arg edit takes is a change. */
const WHERE = new Set(["number", "repo", "project"]);

/** edit's checks before any gh call: the change id and Priority can be, and it changes something. */
export function checkEdit(call: Call): void {
  checkCreate(call);
  const changes = Object.entries(call.args).filter(([n, v]) => !WHERE.has(n) && v !== undefined);
  if (changes.length === 0) {
    throw new UsageError("edit: name what to change");
  }
}

/** The issue's own fields in one gh issue edit: the body read from the file and sent on stdin, a
 * change id as a label made when missing. */
async function change(run: Run, target: Target, at: Card, call: Call): Promise<Result<null>> {
  const flags = editFlags(call);
  const spec = optionalString(call, "spec");
  const make = spec === undefined ? [] : [changeLabel(spec)];
  const bodyFile = optionalString(call, "bodyFile");
  const body = bodyFile === undefined ? undefined : await readText(bodyFile);
  if (body !== undefined && !body.ok) {
    return body;
  }
  if (flags.length === 0 && make.length === 0 && body === undefined) {
    return done;
  }
  return editIssue(run, target, at.number, flags, { body: body?.value, make });
}

/** A change id binds a feature only; the fields, then the Priority. */
export const edit = onIssue((call, { run, target }, at): Result<Plan> => {
  if (optionalString(call, "spec") !== undefined && at.kind !== "feature") {
    return refuse("blocked", "wrong-kind", `--spec binds a feature; #${at.number} is not one`);
  }
  const priority = optionalString(call, "priority");
  const steps: Step[] = [
    () => change(run, target, at, call),
    ...(priority === undefined ? [] : [() => setField(run, target, at, "Priority", priority)]),
  ];
  return { ok: true, value: { steps, said: `#${at.number} edited` } };
});

/** Open; a feature only as not planned, its merge into main being the accept, with no open task. */
function closable(at: Card, notPlanned: boolean): Result<null> {
  if (!at.open) {
    return refuse("blocked", "wrong-status", `#${at.number} is closed already`);
  }
  if (at.kind !== "feature") {
    return done;
  }
  if (!notPlanned) {
    return refuse("blocked", "wrong-kind", "a feature closes only as not planned");
  }
  return at.openSubIssues === 0
    ? done
    : refuse("blocked", "wrong-status", `#${at.number} has ${at.openSubIssues} open sub-issues`);
}

/** The reason as a comment first, then the close, so a rerun after a refused close still has it. */
export const close = onIssue((call, { run, target }, at): Result<Plan> => {
  const notPlanned = flagArg(call, "notPlanned");
  const allowed = closable(at, notPlanned);
  if (!allowed.ok) {
    return allowed;
  }
  const steps: Step[] = [
    () => comment(run, target, at.number, requiredString(call, "reason")),
    () => closeIssue(run, target, at.number, notPlanned),
  ];
  const said = `#${at.number} closed as ${notPlanned ? "not planned" : "completed"}`;
  return { ok: true, value: { steps, said } };
});
