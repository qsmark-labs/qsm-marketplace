// The writes on an issue, and the one read a move makes before them: the issue, its card, the
// Status field's ids and the caller. Each write is idempotent, so running a verb again finishes it.
import { isRecord } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";
import type { Facts } from "../flow.ts";
import { gh, graphql, type Run, variables } from "./gh.ts";
import { FAMILY, ITEM, type Item, nodes, readCard, readFamily, text } from "./items.ts";
import type { Target } from "./target.ts";

/** A single-select field of the board: its id and its options' ids by name. */
type Field = Readonly<{ id: string; options: ReadonlyMap<string, string> }>;

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
  const fields = nodes(isRecord(board) ? board.fields : undefined);
  const field: unknown = fields.find((f) => text(f, "name") === wanted);
  const id = text(field, "id");
  const named = nodes({ nodes: isRecord(field) ? field.options : undefined }).flatMap((o) => {
    const [name, option] = [text(o, "name"), text(o, "id")];
    return name === null || option === null ? [] : [[name, option] as const];
  });
  return id === null ? null : { id, options: new Map(named) };
}

const FIELDS = `query($board:ID!){board:node(id:$board){...on ProjectV2{fields(first:50){nodes{${SELECT}}}}}}`;

/** Whether the board's Priority has the option, read before anything is written. */
export async function hasPriority(run: Run, target: Target, value: string): Promise<Result<null>> {
  const answer = await graphql(run, FIELDS, variables({ board: target.board.id }));
  if (!answer.ok) {
    return answer;
  }
  return fieldOf(answer.value.board, "Priority")?.options.has(value) === true
    ? { ok: true, value: null }
    : refuse("failed", "not-found", `the board's Priority has no option ${value}`);
}

export async function card(run: Run, target: Target, number: number): Promise<Result<Card>> {
  const ids = variables({ repo: target.repoId, board: target.board.id, number });
  const answer = await graphql(run, CARD, ids);
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
  const own = { id, cardId: read.cardId, statusField, priorityField };
  return { ok: true, value: { ...read.item, ...facts, ...own } };
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
export async function setField(
  run: Run,
  target: Target,
  at: Card,
  name: "Status" | "Priority",
  value: string,
): Promise<Result<null>> {
  const field = name === "Status" ? at.statusField : at.priorityField;
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
  return setField(run, target, at, "Status", status);
}

/** Files an issue of the kind's type, its body on stdin; it answers the new issue's number. The
 * labels in `make` it creates when missing and puts on; one in `flags` must exist, or gh fails. */
export async function file(
  run: Run,
  target: Target,
  issue: {
    kind: "task" | "feature";
    title: string;
    body: string;
    flags?: readonly string[];
    make?: readonly string[];
  },
): Promise<Result<number>> {
  for (const name of issue.make ?? []) {
    const made = await label(run, target, name);
    if (!made.ok) {
      return made;
    }
  }
  const type = issue.kind === "task" ? "Task" : "Feature";
  const args = ["issue", "create", "--repo", target.repo, "--title", issue.title, "--type", type];
  const labels = (issue.make ?? []).flatMap((name) => ["--label", name]);
  const made = await gh(
    run,
    [...args, "--body-file", "-", ...labels, ...(issue.flags ?? [])],
    issue.body,
  );
  if (!made.ok) {
    return made;
  }
  const number = Number(made.value.split("/").at(-1));
  return Number.isInteger(number)
    ? { ok: true, value: number }
    : refuse("failed", "refused", `gh filed no issue it could name: ${made.value}`);
}

/** Creates a label the repository lacks; one it has already is left as it is. */
async function label(run: Run, target: Target, name: string): Promise<Result<null>> {
  const made = await run(["label", "create", name, "--repo", target.repo]);
  // gh 2.103.3 answers a label that exists with this text and no code of its own
  const exists = made.exit !== 0 && made.stderr.includes("already exists");
  const done = made.exit === 0 || exists ? null : made.stderr.trim();
  return done === null ? { ok: true, value: null } : refuse("failed", "refused", done);
}

/** `gh issue edit` with the given flags: assignees and labels, in one call. */
export async function edit(
  run: Run,
  target: Target,
  number: number,
  flags: readonly string[],
): Promise<Result<null>> {
  const done = await gh(run, ["issue", "edit", String(number), "--repo", target.repo, ...flags]);
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
