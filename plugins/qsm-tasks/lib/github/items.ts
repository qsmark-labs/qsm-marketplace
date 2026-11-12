// Issues as the verbs read them: plain items with their kind, Status and Priority on the board, read
// by one GraphQL query each (design.md decision 3), so no verb names a field, a type or an id.
import { isRecord } from "../../../../lib/outcome.ts";
import { refuse, type Result, wrongCall } from "../failure.ts";
import { type Kind, STATUS } from "../flow.ts";
import { graphql, type Run, variables } from "./gh.ts";
import type { Target } from "./target.ts";

export interface Item {
  readonly number: number;
  readonly title: string;
  readonly open: boolean;
  readonly kind: Kind | null;
  /** on the board; null when the issue is not on it */
  readonly status: string | null;
  readonly priority: string | null;
  readonly assignees: readonly string[];
  readonly labels: readonly string[];
  /** the issues that block it and are still open */
  readonly blockers: readonly number[];
}

interface Comment {
  readonly author: string;
  readonly at: string;
  readonly body: string;
}

/** An item and what `show` adds to it. */
export interface Issue extends Item {
  readonly body: string;
  readonly parent: number | null;
  readonly subIssues: { readonly total: number; readonly closed: number };
  readonly comments: readonly Comment[];
}

const PAGE = 100;
const SELECT = "...on ProjectV2ItemFieldSingleSelectValue{name}";
const WHOLE = "pageInfo{hasNextPage}";
export const ITEM = `number title state issueType{name} assignees(first:10){${WHOLE} nodes{login}} labels(first:30){${WHOLE} nodes{name}} blockedBy(first:${PAGE}){${WHOLE} nodes{number state}} projectItems(first:10){${WHOLE} nodes{id project{id} status:fieldValueByName(name:"Status"){${SELECT}} priority:fieldValueByName(name:"Priority"){${SELECT}}}}`;
/** The lists an item is read from: a list missing or cut would make the item lie. */
const ITEM_LISTS = ["assignees", "labels", "blockedBy", "projectItems"] as const;
/** Where an issue sits in the tree: its parent and its sub-issues. */
export const FAMILY = "parent{number state} subIssuesSummary{total completed}";
const SEARCH = `query($q:String!){search(type:ISSUE,first:${PAGE},query:$q){pageInfo{hasNextPage} nodes{...on Issue{${ITEM}}}}}`;
const ISSUE = `query($repo:ID!,$number:Int!,$comments:Boolean!){node(id:$repo){...on Repository{issue(number:$number){${ITEM} body ${FAMILY} comments(first:${PAGE})@include(if:$comments){pageInfo{hasNextPage} nodes{author{login} createdAt body}}}}}}`;

/** What a read asks for; an absent field does not narrow it. */
export interface Filter {
  readonly kind?: "task" | "feature";
  readonly open?: true;
  /** the sub-issues of this feature */
  readonly feature?: number | undefined;
  readonly label?: string | undefined;
  readonly without?: string | undefined;
}

const TYPES = { task: "type:Task,Bug", feature: "type:Feature" } as const;

/** The filter as GitHub's search qualifiers, scoped to the repository's issues. */
function qualifiers(repo: string, filter: Filter): string {
  return [
    `repo:${repo} is:issue`,
    filter.kind === undefined ? "" : TYPES[filter.kind],
    filter.open === undefined ? "" : "is:open",
    filter.feature === undefined ? "" : `parent-issue:${repo}#${filter.feature}`,
    filter.label === undefined ? "" : `label:"${filter.label}"`,
    filter.without === undefined ? "" : `-label:"${filter.without}"`,
  ]
    .filter((q) => q !== "")
    .join(" ");
}

export function nodes(connection: unknown): unknown[] {
  return isRecord(connection) && Array.isArray(connection.nodes) ? connection.nodes : [];
}

export function text(record: unknown, key: string): string | null {
  const value = isRecord(record) ? record[key] : undefined;
  return typeof value === "string" ? value : null;
}

function count(record: unknown, key: string): number | null {
  const value = isRecord(record) ? record[key] : undefined;
  return typeof value === "number" ? value : null;
}

function kindOf(type: string | null, labels: readonly string[]): Kind | null {
  if (type === "Task" || type === "Bug") {
    return "task";
  }
  if (type === "Feature") {
    return "feature";
  }
  return labels.includes("feedback") ? "feedback" : null;
}

/** An issue as a read sees it, and the id of its card on the board, which only a write needs. */
export function readCard(
  node: unknown,
  board: string,
): Result<{ item: Item; cardId: string | null }> {
  const number = count(node, "number");
  const title = text(node, "title");
  if (!isRecord(node) || number === null || title === null) {
    return refuse("failed", "refused", "GitHub answered an issue without its number or title");
  }
  const broken = ITEM_LISTS.find((key) => !whole(node[key]));
  if (broken !== undefined) {
    const said = `#${number}: GitHub left out its ${broken} or cut them at the page size`;
    return refuse("failed", "refused", said);
  }
  const labels = nodes(node.labels).flatMap((l) => text(l, "name") ?? []);
  const onBoard = nodes(node.projectItems).find(
    (p) => isRecord(p) && text(p.project, "id") === board,
  );
  const card = isRecord(onBoard) ? onBoard : {};
  const open = node.state === "OPEN";
  // off the board, an issue is where "Item added" or "Item closed" will put it (decision 9)
  const offBoard = open ? STATUS.todo : STATUS.done;
  const item = {
    number,
    title,
    open,
    kind: kindOf(text(node.issueType, "name"), labels),
    status: isRecord(onBoard) ? text(card.status, "name") : offBoard,
    priority: text(card.priority, "name"),
    assignees: nodes(node.assignees).flatMap((a) => text(a, "login") ?? []),
    labels,
    blockers: nodes(node.blockedBy).flatMap((b) =>
      text(b, "state") === "OPEN" ? (count(b, "number") ?? []) : [],
    ),
  };
  return { ok: true, value: { item, cardId: text(card, "id") } };
}

/** The parent and sub-issue counts `FAMILY` reads; no parent is null. */
export function readFamily(node: unknown): {
  parent: number | null;
  parentOpen: boolean | null;
  subIssues: { total: number; closed: number };
} {
  const parent = isRecord(node) ? node.parent : undefined;
  const summary = isRecord(node) ? node.subIssuesSummary : undefined;
  return {
    parent: count(parent, "number"),
    parentOpen: isRecord(parent) ? parent.state === "OPEN" : null,
    subIssues: { total: count(summary, "total") ?? 0, closed: count(summary, "completed") ?? 0 },
  };
}

/** The repository's issues the filter finds, one page; more than a page is a call to narrow. */
export async function search(run: Run, target: Target, filter: Filter): Promise<Result<Item[]>> {
  const q = qualifiers(target.repo, filter);
  const answer = await graphql(run, SEARCH, ["-f", `q=${q}`]);
  if (!answer.ok) {
    return answer;
  }
  const found = answer.value.search;
  if (cut(found)) {
    return wrongCall(`more than ${PAGE} issues match ${q}: narrow the read`);
  }
  if (!whole(found)) {
    return refuse("failed", "refused", "GitHub answered the search without its issues");
  }
  const items: Item[] = [];
  for (const node of nodes(found)) {
    const read = readCard(node, target.board.id);
    if (!read.ok) {
      return read;
    }
    items.push(read.value.item);
  }
  return { ok: true, value: items };
}

/** A connection GitHub cut at its page size: reading it as whole would lie. */
export function cut(connection: unknown): boolean {
  return (
    isRecord(connection) &&
    isRecord(connection.pageInfo) &&
    connection.pageInfo.hasNextPage === true
  );
}

/** A connection that came back with its list and a page check that says it is not cut: one with no
 * pageInfo may be cut, and reading it as whole would lie. */
export function whole(connection: unknown): boolean {
  return (
    isRecord(connection) &&
    Array.isArray(connection.nodes) &&
    isRecord(connection.pageInfo) &&
    typeof connection.pageInfo.hasNextPage === "boolean" &&
    !cut(connection)
  );
}

function readComment(node: unknown): Comment {
  // GitHub answers a deleted account with no author; its own pages call it ghost
  const author = isRecord(node) ? text(node.author, "login") : null;
  return {
    author: author ?? "ghost",
    at: text(node, "createdAt") ?? "",
    body: text(node, "body") ?? "",
  };
}

/** The lists `show` reads whole, by their field and their name. */
const LISTS = [
  ["blockedBy", "blockers"],
  ["comments", "comments"],
] as const;

/** One issue with its body, parent, sub-issue counts and, when asked, its comments oldest first. */
export async function issue(
  run: Run,
  target: Target,
  number: number,
  comments: boolean,
): Promise<Result<Issue>> {
  const answer = await graphql(run, ISSUE, variables({ repo: target.repoId, number, comments }));
  if (!answer.ok) {
    return answer;
  }
  const node = isRecord(answer.value.node) ? answer.value.node.issue : undefined;
  const body = text(node, "body");
  if (!isRecord(node) || body === null) {
    return refuse("failed", "not-found", `no issue #${number} in ${target.repo}`);
  }
  const [, list] = LISTS.find(([key]) => cut(node[key])) ?? [];
  if (list !== undefined) {
    return refuse("failed", "refused", `#${number} has over ${PAGE} ${list}: GitHub cut the list`);
  }
  const read = readCard(node, target.board.id);
  if (!read.ok) {
    return read;
  }
  const { parent, subIssues } = readFamily(node);
  const thread = nodes(node.comments).map(readComment);
  return { ok: true, value: { ...read.value.item, body, parent, subIssues, comments: thread } };
}
