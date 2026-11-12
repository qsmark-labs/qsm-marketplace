// The repository and the board a verb acts on, resolved on every run and never stored, because a
// stored default goes stale when the board moves (design.md decision 2): `--repo`, else the one gh
// resolves; `--project`, else the one board linked to the repository. One query reads both ids.
import { isRecord, UsageError } from "../../../../lib/outcome.ts";
import { refuse, type Result, wrongCall } from "../failure.ts";
import { graphql, type Run } from "./gh.ts";

interface Board {
  readonly id: string;
  readonly owner: string;
  readonly number: number;
}

export interface Target {
  readonly repoId: string;
  /** owner/name */
  readonly repo: string;
  readonly board: Board;
}

const BOARD = "id number owner{...on Organization{login} ...on User{login}}";
// $login and $number default so the linked form can leave them out; @include skips the owner then.
const QUERY = `query($owner:String!,$name:String!,$named:Boolean!,$login:String="",$number:Int=0){repository(owner:$owner,name:$name){id nameWithOwner projectsV2(first:10){nodes{${BOARD}}}} repositoryOwner(login:$login)@include(if:$named){...on ProjectV2Owner{projectV2(number:$number){${BOARD}}}}}`;

function split(value: string, flag: "--repo" | "--project"): [string, string] {
  const shape = flag === "--repo" ? /^([\w.-]+)\/([\w.-]+)$/ : /^([\w.-]+)\/(\d+)$/;
  const match = shape.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) {
    const expected = flag === "--repo" ? "owner/name" : "owner/number";
    throw new UsageError(`${flag} ${value}: expected ${expected}`);
  }
  return [match[1], match[2]];
}

/** gh's field pairs naming the repository; gh fills `{owner}` and `{repo}` itself. */
function repoFields(repo: string | undefined): string[] {
  if (repo === undefined) {
    return ["-F", "owner={owner}", "-F", "name={repo}"];
  }
  const [owner, name] = split(repo, "--repo");
  return ["-f", `owner=${owner}`, "-f", `name=${name}`];
}

/** gh's field pairs naming the board, or asking for the linked ones. */
function boardFields(project: string | undefined): string[] {
  if (project === undefined) {
    return ["-F", "named=false"];
  }
  const [login, number] = split(project, "--project");
  return ["-F", "named=true", "-f", `login=${login}`, "-F", `number=${number}`];
}

function readBoard(node: unknown): Board | null {
  if (!isRecord(node) || typeof node.id !== "string" || typeof node.number !== "number") {
    return null;
  }
  const login = isRecord(node.owner) ? node.owner.login : undefined;
  return typeof login === "string" ? { id: node.id, owner: login, number: node.number } : null;
}

/** The board --project named, or every board linked to the repository. */
function offered(data: Record<string, unknown>, named: boolean): Board[] {
  const owner = data.repositoryOwner;
  const linked =
    isRecord(data.repository) && isRecord(data.repository.projectsV2)
      ? data.repository.projectsV2.nodes
      : [];
  const nodes: unknown[] = named
    ? [isRecord(owner) ? owner.projectV2 : null]
    : Array.isArray(linked)
      ? linked
      : [];
  return nodes.map((node) => readBoard(node)).filter((board) => board !== null);
}

/** The one board: none is `no-board` (linked) or `not-found` (named), several a wrong call. */
function oneBoard(
  repo: string,
  boards: readonly Board[],
  project: string | undefined,
): Result<Board> {
  const [board, ...more] = boards;
  if (board === undefined) {
    return project === undefined
      ? refuse("missing", "no-board", `${repo} has no linked board`, "pass --project")
      : refuse("failed", "not-found", `no board ${project} on GitHub`);
  }
  if (more.length > 0) {
    const names = boards.map((b) => `${b.owner}/${b.number}`).join(", ");
    return wrongCall(`${repo} has several linked boards (${names}): pass --project`);
  }
  return { ok: true, value: board };
}

export async function resolveTarget(
  run: Run,
  given: { readonly repo: string | undefined; readonly project: string | undefined },
): Promise<Result<Target>> {
  const fields = [...repoFields(given.repo), ...boardFields(given.project)];
  const answer = await graphql(run, QUERY, fields);
  if (!answer.ok) {
    return answer;
  }
  const repo = answer.value.repository;
  if (!isRecord(repo) || typeof repo.id !== "string" || typeof repo.nameWithOwner !== "string") {
    return refuse(
      "failed",
      "refused",
      `gh answered without a repository: ${JSON.stringify(answer.value)}`,
    );
  }
  const board = oneBoard(
    repo.nameWithOwner,
    offered(answer.value, given.project !== undefined),
    given.project,
  );
  return board.ok
    ? { ok: true, value: { repoId: repo.id, repo: repo.nameWithOwner, board: board.value } }
    : board;
}
