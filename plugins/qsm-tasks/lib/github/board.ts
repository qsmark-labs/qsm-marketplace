// The writes on an issue, and the one read a move makes before them: the issue, its card, the
// Status field's ids and the caller. Each write is idempotent, so running a verb again finishes it.
import { isRecord } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";
import type { Facts } from "../flow.ts";
import { gh, graphql, type Run, variables } from "./gh.ts";
import { ITEM, type Item, readCard, text } from "./items.ts";
import type { Target } from "./target.ts";

/** An issue as a move sees it: the item, what its guard reads, and the ids its writes need. */
export interface Card extends Item, Facts {
  readonly id: string;
  /** its card on the board; null before it is added */
  readonly cardId: string | null;
  readonly field: { readonly id: string; readonly options: ReadonlyMap<string, string> };
}

const CARD = `query($repo:ID!,$board:ID!,$number:Int!){viewer{login} board:node(id:$board){...on ProjectV2{field(name:"Status"){...on ProjectV2SingleSelectField{id options{id name}}}}} repo:node(id:$repo){...on Repository{issue(number:$number){id ${ITEM}}}}}`;
const ADD = `mutation($board:ID!,$issue:ID!){addProjectV2ItemById(input:{projectId:$board,contentId:$issue}){item{id}}}`;
const SET = `mutation($board:ID!,$card:ID!,$field:ID!,$option:String!){updateProjectV2ItemFieldValue(input:{projectId:$board,itemId:$card,fieldId:$field,value:{singleSelectOptionId:$option}}){clientMutationId}}`;

function optionsOf(field: unknown): Map<string, string> {
  const options = isRecord(field) && Array.isArray(field.options) ? field.options : [];
  return new Map(
    options.flatMap((o) => {
      const name = text(o, "name");
      const id = text(o, "id");
      return name === null || id === null ? [] : [[name, id] as const];
    }),
  );
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
  const status = isRecord(board) ? board.field : undefined;
  const [id, caller, fieldId] = [text(issue, "id"), text(viewer, "login"), text(status, "id")];
  if (read === null || id === null || caller === null || fieldId === null) {
    return refuse(
      "failed",
      "not-found",
      `no issue #${number} in ${target.repo}, or no Status field`,
    );
  }
  const field = { id: fieldId, options: optionsOf(status) };
  return { ok: true, value: { ...read.item, id, cardId: read.cardId, caller, field } };
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

/** Sets the card's Status, adding the card first when the issue is not on the board. */
export async function setStatus(
  run: Run,
  target: Target,
  at: Card,
  status: string,
): Promise<Result<null>> {
  const option = at.field.options.get(status);
  if (option === undefined) {
    return refuse("failed", "not-found", `the board's Status has no option ${status}`);
  }
  const placed = await cardOn(run, target, at);
  if (!placed.ok) {
    return placed;
  }
  const ids = variables({ board: target.board.id, card: placed.value, field: at.field.id, option });
  const set = await graphql(run, SET, ids);
  return set.ok ? { ok: true, value: null } : set;
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
