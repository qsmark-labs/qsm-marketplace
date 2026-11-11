// The repository and the board a verb acts on, resolved on every run and never stored, because a
// stored default goes stale when the board moves (design.md decision 2): `--repo`, else the one gh
// resolves; `--project`, else the one board linked to the repository. One query reads both ids.
import { isRecord, UsageError } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";
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

const REPO = "repository(owner:$owner,name:$name){id nameWithOwner";
const LINKED = `query($owner:String!,$name:String!){${REPO} projectsV2(first:10){nodes{id number owner{...on Organization{login} ...on User{login}}}}}}`;
const NAMED = `query($owner:String!,$name:String!,$login:String!,$number:Int!){${REPO}} repositoryOwner(login:$login){...on ProjectV2Owner{projectV2(number:$number){id number}}}}`;

function split(value: string, flag: "--repo" | "--project"): [string, string] {
  const shape = flag === "--repo" ? /^([\w.-]+)\/([\w.-]+)$/ : /^([\w.-]+)\/(\d+)$/;
  const match = shape.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) {
    const expected = flag === "--repo" ? "owner/name" : "owner/number";
    throw new UsageError(`${flag} ${value}: expected ${expected}`);
  }
  return [match[1], match[2]];
}

/** gh's `-F`/`-f` pairs naming the repository; gh fills `{owner}` and `{repo}` itself. */
function repoFields(repo: string | undefined): string[] {
  if (repo === undefined) {
    return ["-F", "owner={owner}", "-F", "name={repo}"];
  }
  const [owner, name] = split(repo, "--repo");
  return ["-f", `owner=${owner}`, "-f", `name=${name}`];
}

function readRepo(data: Record<string, unknown>): {
  readonly id: string;
  readonly nameWithOwner: string;
  readonly projects: unknown;
} {
  const repo = data.repository;
  if (!isRecord(repo) || typeof repo.id !== "string" || typeof repo.nameWithOwner !== "string") {
    throw new Error(`gh answered without a repository: ${JSON.stringify(data)}`);
  }
  return { id: repo.id, nameWithOwner: repo.nameWithOwner, projects: repo.projectsV2 };
}

function readBoard(node: unknown, owner?: string): Board | null {
  if (!isRecord(node) || typeof node.id !== "string" || typeof node.number !== "number") {
    return null;
  }
  const login = owner ?? (isRecord(node.owner) ? node.owner.login : undefined);
  return typeof login === "string" ? { id: node.id, owner: login, number: node.number } : null;
}

/** The one board linked to the repository: none is `no-board`, several a usage naming them. */
function linkedBoard(repo: string, projects: unknown): Result<Board> {
  const nodes = isRecord(projects) && Array.isArray(projects.nodes) ? projects.nodes : [];
  const boards = nodes.map((n) => readBoard(n)).filter((b) => b !== null);
  const [only] = boards;
  if (only === undefined) {
    return refuse("missing", "no-board", `${repo} has no linked board`, "pass --project");
  }
  if (boards.length > 1) {
    const names = boards.map((b) => `${b.owner}/${b.number}`).join(", ");
    throw new UsageError(`${repo} has several linked boards (${names}): pass --project`);
  }
  return { ok: true, value: only };
}

/** The board `--project` names; an owner or number GitHub does not know is `not-found`. */
function namedBoard(owned: unknown, [owner, number]: [string, string]): Result<Board> {
  const board = readBoard(isRecord(owned) ? owned.projectV2 : undefined, owner);
  return board === null
    ? refuse("failed", "not-found", `no board ${owner}/${number} on GitHub`)
    : { ok: true, value: board };
}

export async function resolveTarget(
  run: Run,
  given: { readonly repo: string | undefined; readonly project: string | undefined },
): Promise<Result<Target>> {
  const fields = repoFields(given.repo);
  const project = given.project === undefined ? undefined : split(given.project, "--project");
  const answer =
    project === undefined
      ? await graphql(run, LINKED, fields)
      : await graphql(run, NAMED, [
          ...fields,
          "-f",
          `login=${project[0]}`,
          "-F",
          `number=${project[1]}`,
        ]);
  if (!answer.ok) {
    return answer;
  }
  const repo = readRepo(answer.value);
  const board =
    project === undefined
      ? linkedBoard(repo.nameWithOwner, repo.projects)
      : namedBoard(answer.value.repositoryOwner, project);
  return board.ok
    ? { ok: true, value: { repoId: repo.id, repo: repo.nameWithOwner, board: board.value } }
    : board;
}
