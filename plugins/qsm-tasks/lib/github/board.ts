// The writes on an issue, and the one read a move makes before them: the issue, its card, the
// Status field's ids and the caller. Each write is idempotent, so running a verb again finishes it.
import { isRecord } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";
import type { Facts, Kind } from "../flow.ts";
import { gh, graphql, type Run, variables } from "./gh.ts";
import { FAMILY, ITEM, type Item, readCard, readFamily, text } from "./items.ts";
import type { Target } from "./target.ts";

/** A single-select field of the board: its id and its options' ids by name. */
interface Field {
  readonly id: string;
  readonly options: ReadonlyMap<string, string>;
}

/** An issue as a move sees it: the item, what its guard reads, and the ids its writes need. */
export interface Card extends Item, Facts {
  readonly id: string;
  /** its card on the board; null before it is added */
  readonly cardId: string | null;
  readonly statusField: Field;
  /** null on a board that has no Priority field yet */
  readonly priorityField: Field | null;
}

// every field, picked by name: asking for a field by a name the board lacks fails the whole query
const SELECT = "...on ProjectV2SingleSelectField{id name options{id name}}";
const CARD = `query($repo:ID!,$board:ID!,$number:Int!){viewer{login} board:node(id:$board){...on ProjectV2{fields(first:50){nodes{${SELECT}}}}} repo:node(id:$repo){...on Repository{issue(number:$number){id ${ITEM} ${FAMILY}}}}}`;
const ADD = `mutation($board:ID!,$issue:ID!){addProjectV2ItemById(input:{projectId:$board,contentId:$issue}){item{id}}}`;
const SET = `mutation($board:ID!,$card:ID!,$field:ID!,$option:String!){updateProjectV2ItemFieldValue(input:{projectId:$board,itemId:$card,fieldId:$field,value:{singleSelectOptionId:$option}}){clientMutationId}}`;

/** The single-select field of this name on the board, or null when it has none. */
function fieldOf(board: unknown, wanted: string): Field | null {
  const fields =
    isRecord(board) && isRecord(board.fields) && Array.isArray(board.fields.nodes)
      ? board.fields.nodes
      : [];
  const field: unknown = fields.find((f) => text(f, "name") === wanted);
  const id = text(field, "id");
  const options = isRecord(field) && Array.isArray(field.options) ? field.options : [];
  const named = options.flatMap((o) => {
    const name = text(o, "name");
    const option = text(o, "id");
    return name === null || option === null ? [] : [[name, option] as const];
  });
  return id === null ? null : { id, options: new Map(named) };
}

export async function card(run: Run, target: Target, number: number): Promise<Result<Card>> {
  const vars = variables({ repo: target.repoId, board: target.board.id, number });
  const answer = await graphql(run, CARD, vars);
  if (!answer.ok) {
    return answer;
  }
  const { viewer, board, repo } = answer.value;
  const issue = isRecord(repo) ? repo.issue : undefined;
  const read = readCard(issue, target.board.id);
  const statusField = fieldOf(board, "Status");
  const priorityField = fieldOf(board, "Priority");
  const [id, caller] = [text(issue, "id"), text(viewer, "login")];
  if (read === null || id === null || caller === null || statusField === null) {
    return refuse(
      "failed",
      "not-found",
      `no issue #${number} in ${target.repo}, or no Status field`,
    );
  }
  const { parentOpen, subIssues } = readFamily(issue);
  const openSubIssues = subIssues.total - subIssues.closed;
  const facts = { caller, parentOpen, openSubIssues };
  const ids = { id, cardId: read.cardId, statusField, priorityField };
  return { ok: true, value: { ...read.item, ...facts, ...ids } };
}

/** The card's id, adding the issue to the board first when it is not on it yet. */
async function cardOn(run: Run, target: Target, at: Card): Promise<Result<string>> {
  if (at.cardId !== null) {
    return { ok: true, value: at.cardId };
  }
  const added = await graphql(run, ADD, variables({ board: target.board.id, issue: at.id }));
  if (!added.ok) {
    return added;
  }
  const add = added.value.addProjectV2ItemById;
  const id = text(isRecord(add) ? add.item : undefined, "id");
  return id === null
    ? refuse("failed", "refused", "GitHub added no card")
    : { ok: true, value: id };
}

/** Sets one of the card's fields, adding the card first when the issue is not on the board. */
async function setOption(
  run: Run,
  target: Target,
  at: Card,
  [name, field]: readonly [string, Field | null],
  value: string,
): Promise<Result<null>> {
  const option = field?.options.get(value);
  if (field === null || option === undefined) {
    return refuse("failed", "not-found", `the board's ${name} has no option ${value}`);
  }
  const placed = await cardOn(run, target, at);
  if (!placed.ok) {
    return placed;
  }
  const ids = variables({ board: target.board.id, card: placed.value, field: field.id, option });
  const set = await graphql(run, SET, ids);
  return set.ok ? { ok: true, value: null } : set;
}

export function setStatus(
  run: Run,
  target: Target,
  at: Card,
  status: string,
): Promise<Result<null>> {
  return setOption(run, target, at, ["Status", at.statusField], status);
}

export function setPriority(
  run: Run,
  target: Target,
  at: Card,
  value: string,
): Promise<Result<null>> {
  return setOption(run, target, at, ["Priority", at.priorityField], value);
}

/** Files an issue of the kind's type, its body on stdin; it answers the new issue's number. */
export async function file(
  run: Run,
  target: Target,
  issue: { kind: Kind; title: string; body: string; flags: readonly string[] },
): Promise<Result<number>> {
  // feedback is a plain issue with no type: its label names its kind
  const type = { task: ["--type", "Task"], feature: ["--type", "Feature"], feedback: [] }[
    issue.kind
  ];
  const args = ["issue", "create", "--repo", target.repo, "--title", issue.title, ...type];
  const made = await gh(run, [...args, "--body-file", "-", ...issue.flags], issue.body);
  if (!made.ok) {
    return made;
  }
  const number = Number(made.value.split("/").at(-1));
  return Number.isInteger(number)
    ? { ok: true, value: number }
    : refuse("failed", "refused", `gh filed no issue it could name: ${made.value}`);
}

/** Creates a label the repository lacks; one it has already is left as it is. */
export async function label(run: Run, target: Target, name: string): Promise<Result<null>> {
  const made = await run(["label", "create", name, "--repo", target.repo]);
  // gh 2.103.3 answers a label that exists with this text and no code of its own
  const exists = made.exit !== 0 && made.stderr.includes("already exists");
  const done = made.exit === 0 || exists ? null : made.stderr.trim();
  return done === null ? { ok: true, value: null } : refuse("failed", "refused", done);
}

/** `gh issue edit` with the given flags in one call; a body given goes on stdin. */
export async function edit(
  run: Run,
  target: Target,
  number: number,
  flags: readonly string[],
  body?: string,
): Promise<Result<null>> {
  const args = ["issue", "edit", String(number), "--repo", target.repo, ...flags];
  const done = await gh(run, body === undefined ? args : [...args, "--body-file", "-"], body);
  return done.ok ? { ok: true, value: null } : done;
}

/** Closes an issue as completed, or as not planned: GitHub keeps the reason, no Status changes. */
export async function close(
  run: Run,
  target: Target,
  number: number,
  notPlanned: boolean,
): Promise<Result<null>> {
  const reason = notPlanned ? "not planned" : "completed";
  const done = await gh(run, [
    "issue",
    "close",
    String(number),
    "--repo",
    target.repo,
    "--reason",
    reason,
  ]);
  return done.ok ? { ok: true, value: null } : done;
}

/** Opens a closed issue again. */
export async function reopen(run: Run, target: Target, number: number): Promise<Result<null>> {
  const done = await gh(run, ["issue", "reopen", String(number), "--repo", target.repo]);
  return done.ok ? { ok: true, value: null } : done;
}

/** One comment on an issue, its text on stdin so quotes and newlines reach GitHub unchanged. */
export function comment(
  run: Run,
  target: Target,
  number: number,
  body: string,
): Promise<Result<string>> {
  return gh(
    run,
    ["issue", "comment", String(number), "--repo", target.repo, "--body-file", "-"],
    body,
  );
}
