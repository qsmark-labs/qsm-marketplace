// What doctor checks on GitHub, read in one query: the issue types, the labels and the feedback
// template of the repository, the fields, workflows and views of its board, and the token's scopes.
// A check is ok, failed with its fix, or manual where the API cannot answer (design.md, measured).
import { isRecord } from "../../../../lib/outcome.ts";
import type { Result } from "../failure.ts";
import { FROM, KINDS } from "../feedback.ts";
import { DEFERRED, PRIORITY_NAMES, STATUS } from "../flow.ts";
import { gh, graphql, type Run, variables } from "./gh.ts";
import type { Target } from "./target.ts";

export interface Check {
  readonly name: string;
  readonly status: "ok" | "failed" | "manual";
  readonly fix?: string;
}

export interface Health {
  readonly url: string;
  readonly scopes: readonly string[] | null;
  readonly types: readonly string[];
  readonly labels: readonly string[];
  readonly template: boolean;
  readonly fields: readonly { readonly name: string; readonly options: readonly string[] }[];
  readonly workflows: readonly { readonly name: string; readonly enabled: boolean }[];
  readonly views: readonly string[];
}

const HEALTH = `query($repo:ID!,$board:ID!){repo:node(id:$repo){...on Repository{issueTypes(first:20){nodes{name}} labels(first:100){nodes{name}} template:object(expression:"HEAD:.github/ISSUE_TEMPLATE/feedback.yml"){...on Blob{byteSize}}}} board:node(id:$board){...on ProjectV2{url fields(first:50){nodes{...on ProjectV2FieldCommon{name} ...on ProjectV2SingleSelectField{options{name}}}} workflows(first:20){nodes{name enabled}} views(first:20){nodes{name}}}}}`;

/** The labels the flow and feedback write; setup creates the ones the repository lacks. */
const LABELS = [
  DEFERRED,
  "feedback",
  ...KINDS.map((k) => `kind:${k}`),
  ...FROM.map((f) => `from:${f}`),
];

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

function names(connection: unknown, key = "name"): string[] {
  const nodes = isRecord(connection) && Array.isArray(connection.nodes) ? connection.nodes : [];
  return nodes.flatMap((n) => (isRecord(n) && typeof n[key] === "string" ? [n[key]] : []));
}

/** The token's scopes from GitHub's response header; null when the token reports none. */
async function scopesOf(run: Run): Promise<Result<string[] | null>> {
  const head = await gh(run, ["api", "-i", "user"]);
  if (!head.ok) {
    return head;
  }
  const line = head.value.split("\n").find((l) => l.toLowerCase().startsWith("x-oauth-scopes:"));
  return {
    ok: true,
    value:
      line === undefined
        ? null
        : line
            .slice(line.indexOf(":") + 1)
            .split(",")
            .map((s) => s.trim()),
  };
}

function nodesOf(connection: unknown): unknown[] {
  return isRecord(connection) && Array.isArray(connection.nodes) ? connection.nodes : [];
}

/** The board's half of the answer: its fields with their options, workflows and views. */
function boardOf(
  board: Record<string, unknown>,
): Pick<Health, "url" | "fields" | "workflows" | "views"> {
  return {
    url: typeof board.url === "string" ? board.url : "",
    fields: nodesOf(board.fields).flatMap((f) =>
      isRecord(f) && typeof f.name === "string"
        ? [{ name: f.name, options: names({ nodes: f.options }) }]
        : [],
    ),
    workflows: nodesOf(board.workflows).flatMap((w) =>
      isRecord(w) && typeof w.name === "string"
        ? [{ name: w.name, enabled: w.enabled === true }]
        : [],
    ),
    views: names(board.views),
  };
}

export async function health(run: Run, target: Target): Promise<Result<Health>> {
  const scopes = await scopesOf(run);
  if (!scopes.ok) {
    return scopes;
  }
  const answer = await graphql(
    run,
    HEALTH,
    variables({ repo: target.repoId, board: target.board.id }),
  );
  if (!answer.ok) {
    return answer;
  }
  const repo = isRecord(answer.value.repo) ? answer.value.repo : {};
  const board = isRecord(answer.value.board) ? answer.value.board : {};
  const repoPart = {
    types: names(repo.issueTypes),
    labels: names(repo.labels),
    template: isRecord(repo.template),
  };
  return { ok: true, value: { scopes: scopes.value, ...repoPart, ...boardOf(board) } };
}

/** A field's line: there, with exactly the options the flow names; a missing option setup adds, an
 * option the flow does not name the owner removes in the web UI. */
function fieldCheck(at: Health, name: string, wanted: readonly string[]): Check {
  const field = at.fields.find((f) => f.name === name);
  if (field === undefined) {
    return { name: `field ${name}`, status: "failed", fix: "qsm-tasks setup creates it" };
  }
  const extra = field.options.filter((o) => !wanted.includes(o));
  if (extra.length > 0) {
    return {
      name: `field ${name}`,
      status: "failed",
      fix: `remove ${extra.join(", ")} in ${at.url}/settings`,
    };
  }
  const missing = wanted.filter((o) => !field.options.includes(o));
  return missing.length === 0
    ? { name: `field ${name}`, status: "ok" }
    : {
        name: `field ${name}`,
        status: "failed",
        fix: `qsm-tasks setup adds ${missing.join(", ")}`,
      };
}

function workflowCheck(at: Health, [name, sets]: readonly [string, string | null]): Check {
  const on = at.workflows.some((w) => w.name === name && w.enabled);
  if (!on) {
    return { name: `workflow ${name}`, status: "failed", fix: `turn it on in ${at.url}/workflows` };
  }
  return sets === null
    ? { name: `workflow ${name}`, status: "ok" }
    : {
        name: `workflow ${name}`,
        status: "manual",
        fix: `check it sets ${sets} in ${at.url}/workflows`,
      };
}

/** Every check doctor prints, in its order. */
export function checks(at: Health): Check[] {
  const scope = at.scopes === null ? "manual" : at.scopes.includes("project") ? "ok" : "failed";
  return [
    { name: "gh login with the project scope", status: scope, fix: "gh auth refresh -s project" },
    ...["Feature", "Task", "Bug"].map((t): Check =>
      at.types.includes(t)
        ? { name: `issue type ${t}`, status: "ok" }
        : {
            name: `issue type ${t}`,
            status: "failed",
            fix: "add it in the organization's settings",
          },
    ),
    fieldCheck(at, "Status", Object.values(STATUS)),
    fieldCheck(at, "Priority", PRIORITY_NAMES),
    ...LEFTOVER_FIELDS.filter((f) => at.fields.some((x) => x.name === f)).map((f): Check => ({
      name: `field ${f}`,
      status: "failed",
      fix: `delete it in ${at.url}/settings`,
    })),
    ...LABELS.map((l): Check =>
      at.labels.includes(l)
        ? { name: `label ${l}`, status: "ok" }
        : { name: `label ${l}`, status: "failed", fix: "qsm-tasks setup creates it" },
    ),
    ...WORKFLOWS.map((w) => workflowCheck(at, w)),
    ...["Tasks", "Features"].map((v): Check =>
      at.views.includes(v)
        ? { name: `view ${v}`, status: "manual", fix: `check its filter in ${at.url}` }
        : { name: `view ${v}`, status: "failed", fix: `create it in ${at.url}` },
    ),
    at.template
      ? { name: "feedback template", status: "ok" }
      : {
          name: "feedback template",
          status: "failed",
          fix: "add .github/ISSUE_TEMPLATE/feedback.yml",
        },
  ];
}
