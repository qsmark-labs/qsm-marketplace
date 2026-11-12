// What setup creates, and only that: a field the board lacks with all its options and definitions,
// an option a field lacks, and a label the repository lacks. It never renames or deletes, so an
// option it does not know stays, and doctor names it.
import { isRecord } from "../../../../lib/outcome.ts";
import type { Result } from "../failure.ts";
import { definitions } from "../flow.ts";
import { graphql, graphqlJson, type Run, variables } from "./gh.ts";
import { LABELS } from "./health.ts";
import { label } from "./board.ts";
import type { Target } from "./target.ts";

/** One thing setup makes: what it says, and the write. */
export interface Change {
  readonly said: string;
  readonly make: () => Promise<Result<unknown>>;
}

interface Option {
  readonly id?: string;
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

const READ = `query($repo:ID!,$board:ID!){repo:node(id:$repo){...on Repository{labels(first:100){nodes{name}}}} board:node(id:$board){...on ProjectV2{fields(first:50){nodes{...on ProjectV2SingleSelectField{id name options{id name color description}}}}}}}`;
const UPDATE = `mutation($field:ID!,$options:[ProjectV2SingleSelectFieldOptionInput!]!){updateProjectV2Field(input:{fieldId:$field,singleSelectOptions:$options}){clientMutationId}}`;
const CREATE = `mutation($board:ID!,$name:String!,$options:[ProjectV2SingleSelectFieldOptionInput!]!){createProjectV2Field(input:{projectId:$board,dataType:SINGLE_SELECT,name:$name,singleSelectOptions:$options}){clientMutationId}}`;

function nodes(connection: unknown): Record<string, unknown>[] {
  const list = isRecord(connection) && Array.isArray(connection.nodes) ? connection.nodes : [];
  return list.filter((n) => isRecord(n));
}

function optionOf(node: Record<string, unknown>): Option[] {
  const { id, name, color, description } = node;
  return typeof id === "string" &&
    typeof name === "string" &&
    typeof color === "string" &&
    typeof description === "string"
    ? [{ id, name, color, description }]
    : [];
}

/** The field's change: create it whole, or add the options it lacks, keeping each it has by id. */
function fieldChange(
  run: Run,
  target: Target,
  name: "Status" | "Priority",
  field: Record<string, unknown> | undefined,
): Change[] {
  const wanted = definitions()[name].map((d) => ({ ...d, color: "GRAY" }));
  if (field === undefined) {
    const make = () => graphqlJson(run, CREATE, { board: target.board.id, name, options: wanted });
    return [{ said: `created field ${name} with ${wanted.map((w) => w.name).join(", ")}`, make }];
  }
  const kept = nodes({ nodes: field.options }).flatMap(optionOf);
  const added = wanted.filter((w) => !kept.some((k) => k.name === w.name));
  if (added.length === 0) {
    return [];
  }
  const make = () => graphqlJson(run, UPDATE, { field: field.id, options: [...kept, ...added] });
  return [{ said: `added to ${name}: ${added.map((a) => a.name).join(", ")}`, make }];
}

/** Everything the board and the repository lack, as changes; none when setup has run before. */
export async function changes(run: Run, target: Target): Promise<Result<Change[]>> {
  const answer = await graphql(
    run,
    READ,
    variables({ repo: target.repoId, board: target.board.id }),
  );
  if (!answer.ok) {
    return answer;
  }
  const fields = nodes(isRecord(answer.value.board) ? answer.value.board.fields : undefined);
  const labels = new Set(
    nodes(isRecord(answer.value.repo) ? answer.value.repo.labels : undefined).map((l) => l.name),
  );
  const field = (name: string) => fields.find((f) => f.name === name);
  return {
    ok: true,
    value: [
      ...fieldChange(run, target, "Status", field("Status")),
      ...fieldChange(run, target, "Priority", field("Priority")),
      ...LABELS.filter((l) => !labels.has(l)).map((l) => ({
        said: `created label ${l}`,
        make: () => label(run, target, l),
      })),
    ],
  };
}
