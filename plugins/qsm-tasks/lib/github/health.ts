// What doctor checks on GitHub, read in one query: the issue types, the labels and the feedback
// template of the repository, the fields, workflows and views of its board, and the token's scopes.
// A check is ok, failed with its fix, or manual where the API cannot answer (design.md, measured).
import { fail, isRecord, type Outcome, ok } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";
import { FEEDBACK_KINDS, FROM } from "../feedback.ts";
import { DEFERRED, PRIORITY_NAMES, STATUS } from "../flow.ts";
import { gh, graphql, type Run, variables } from "./gh.ts";
import { cut, nodes, text } from "./items.ts";
import type { Target } from "./target.ts";

export interface Check {
  readonly name: string;
  readonly status: "ok" | "failed" | "manual";
  readonly fix?: string;
}

/** A single-select option as GitHub holds it; its id keeps a card's value when the field changes. */
interface Option {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

interface Field {
  readonly id: string;
  readonly name: string;
  readonly options: readonly Option[];
}

export interface Health {
  readonly url: string;
  readonly scopes: readonly string[] | null;
  readonly types: readonly string[];
  readonly labels: readonly string[];
  readonly template: boolean;
  readonly fields: readonly Field[];
  readonly workflows: readonly { readonly name: string; readonly enabled: boolean }[];
  readonly views: readonly string[];
}

const HEALTH = `query($repo:ID!,$board:ID!){repo:node(id:$repo){...on Repository{issueTypes(first:20){nodes{name}} labels(first:100){pageInfo{hasNextPage} nodes{name}} template:object(expression:"HEAD:.github/ISSUE_TEMPLATE/feedback.yml"){...on Blob{byteSize}}}} board:node(id:$board){...on ProjectV2{url fields(first:50){nodes{...on ProjectV2FieldCommon{id name} ...on ProjectV2SingleSelectField{options{id name color description}}}} workflows(first:20){nodes{name enabled}} views(first:20){nodes{name}}}}}`;

/** What the flow needs of the board and the repository: each field's options, and the labels the
 * flow and feedback write. Doctor fails what is missing; setup creates it. */
const FIELDS: Record<"Status" | "Priority", readonly string[]> = {
  Status: Object.values(STATUS),
  Priority: PRIORITY_NAMES,
};
const LABELS = [
  DEFERRED,
  "feedback",
  ...FEEDBACK_KINDS.map((k) => `kind:${k}`),
  ...FROM.map((f) => `from:${f}`),
];
const SETUP_MAKES = "qsm-tasks setup creates it";

/** Each built-in workflow doctor needs on, and the Status it sets, which the API cannot read. */
const WORKFLOWS: readonly (readonly [string, string | null])[] = [
  ["Auto-add to project", null],
  ["Auto-add sub-issues to project", null],
  ["Item added to project", STATUS.todo],
  ["Item closed", STATUS.done],
  ["Pull request linked to issue", STATUS.agentReview],
];

/** A field the old board had and this flow does not: the owner deletes it in the web UI. */
const LEFTOVER_FIELDS = ["Epic stage"];

function names(connection: unknown): string[] {
  return nodes(connection).flatMap((n) => text(n, "name") ?? []);
}

/** The token's scopes from GitHub's response header; null when the token reports none. */
async function scopesOf(run: Run): Promise<Result<string[] | null>> {
  const head = await gh(run, ["api", "-i", "user"]);
  if (!head.ok) {
    return head;
  }
  const line = head.value.split("\n").find((l) => l.toLowerCase().startsWith("x-oauth-scopes:"));
  const scopes = line?.slice(line.indexOf(":") + 1).split(",");
  return { ok: true, value: scopes?.map((s) => s.trim()) ?? null };
}

function optionOf(node: unknown): Option[] {
  const [id, name] = [text(node, "id"), text(node, "name")];
  const [color, description] = [text(node, "color"), text(node, "description")];
  return id === null || name === null || color === null || description === null
    ? []
    : [{ id, name, color, description }];
}

/** The board's half of the answer: its fields with their options, workflows and views. */
function boardOf(board: unknown): Pick<Health, "url" | "fields" | "workflows" | "views"> {
  const fields = nodes(isRecord(board) ? board.fields : undefined).flatMap((f) => {
    const [id, name] = [text(f, "id"), text(f, "name")];
    const options = nodes({ nodes: isRecord(f) ? f.options : undefined }).flatMap(optionOf);
    return id === null || name === null ? [] : [{ id, name, options }];
  });
  const workflows = nodes(isRecord(board) ? board.workflows : undefined).flatMap((w) => {
    const name = text(w, "name");
    return name === null ? [] : [{ name, enabled: isRecord(w) && w.enabled === true }];
  });
  const views = names(isRecord(board) ? board.views : undefined);
  return { url: text(board, "url") ?? "", fields, workflows, views };
}

export async function health(run: Run, target: Target): Promise<Result<Health>> {
  const scopes = await scopesOf(run);
  if (!scopes.ok) {
    return scopes;
  }
  const ids = variables({ repo: target.repoId, board: target.board.id });
  const answer = await graphql(run, HEALTH, ids);
  if (!answer.ok) {
    return answer;
  }
  const repo = isRecord(answer.value.repo) ? answer.value.repo : {};
  if (cut(repo.labels)) {
    return refuse("failed", "refused", `${target.repo} has over 100 labels: GitHub cut the list`);
  }
  const repoPart = {
    types: names(repo.issueTypes),
    labels: names(repo.labels),
    template: isRecord(repo.template),
  };
  return { ok: true, value: { scopes: scopes.value, ...repoPart, ...boardOf(answer.value.board) } };
}

/** A field the flow needs against the board: the field, the options it lacks, and the ones the flow
 * does not name; all lacking when the board has no such field. */
function fieldGap(at: Health, name: keyof typeof FIELDS) {
  const field = at.fields.find((f) => f.name === name);
  const present = field?.options.map((o) => o.name) ?? [];
  const missing = FIELDS[name].filter((o) => !present.includes(o));
  return { field, missing, extra: present.filter((o) => !FIELDS[name].includes(o)) };
}

/** ok when it is there, else failed with what fixes it. */
function has(name: string, present: boolean, fix: string): Check {
  return present ? { name, status: "ok" } : { name, status: "failed", fix };
}

/** A field's line: a missing field or option setup adds, an option the flow does not name the
 * owner removes in the web UI. */
function fieldCheck(at: Health, name: keyof typeof FIELDS): Check {
  const { field, missing, extra } = fieldGap(at, name);
  if (extra.length > 0) {
    const fix = `remove ${extra.join(", ")} in ${at.url}/settings`;
    return { name: `field ${name}`, status: "failed", fix };
  }
  const fix = field === undefined ? SETUP_MAKES : `qsm-tasks setup adds ${missing.join(", ")}`;
  return has(`field ${name}`, missing.length === 0, fix);
}

function workflowCheck(at: Health, [name, sets]: readonly [string, string | null]): Check {
  const on = at.workflows.some((w) => w.name === name && w.enabled);
  if (!on || sets === null) {
    return has(`workflow ${name}`, on, `turn it on in ${at.url}/workflows`);
  }
  const fix = `check it sets ${sets} in ${at.url}/workflows`;
  return { name: `workflow ${name}`, status: "manual", fix };
}

/** Every check doctor prints, in its order. */
export function checks(at: Health): Check[] {
  const scope = at.scopes === null ? "manual" : at.scopes.includes("project") ? "ok" : "failed";
  const types = ["Feature", "Task", "Bug"];
  const leftovers = LEFTOVER_FIELDS.filter((f) => at.fields.some((x) => x.name === f));
  return [
    { name: "gh login with the project scope", status: scope, fix: "gh auth refresh -s project" },
    ...types.map((t) =>
      has(`issue type ${t}`, at.types.includes(t), "add it in the organization's settings"),
    ),
    fieldCheck(at, "Status"),
    fieldCheck(at, "Priority"),
    ...leftovers.map((f) => has(`field ${f}`, false, `delete it in ${at.url}/settings`)),
    ...LABELS.map((l) => has(`label ${l}`, at.labels.includes(l), SETUP_MAKES)),
    ...WORKFLOWS.map((w) => workflowCheck(at, w)),
    ...["Tasks", "Features"].map((v): Check =>
      at.views.includes(v)
        ? { name: `view ${v}`, status: "manual", fix: `check its filter in ${at.url}` }
        : has(`view ${v}`, false, `create it in ${at.url}`),
    ),
    has("feedback template", at.template, "add .github/ISSUE_TEMPLATE/feedback.yml"),
  ];
}

/** `ok`, `failed` or `manual`, the check, and what fixes it. */
function row(check: Check): string {
  const fix = check.status === "ok" || check.fix === undefined ? "" : `: ${check.fix}`;
  return `  ${check.status.padEnd(6)}  ${check.name}${fix}`;
}

/** The lines and the verdict of every check: failed when any failed, partial when only manual ones
 * remain, ok when every one is ok. */
export function verdict(head: string, list: readonly Check[]): Outcome {
  const message = [head, ...list.map(row)].join("\n");
  const data = { checks: list };
  if (list.some((c) => c.status === "failed")) {
    return fail("failed", message, data);
  }
  return list.some((c) => c.status === "manual")
    ? { code: "partial", message, data }
    : ok(data, message);
}
