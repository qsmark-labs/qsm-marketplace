// What setup creates, and only that: a field the board lacks with all its options and definitions,
// an option a field lacks, and a label the repository lacks. It never renames or deletes, so an
// option it does not know stays, and doctor names it.
import { definitions } from "../flow.ts";
import { fieldGap, type Health, LABELS } from "./health.ts";

/** One thing setup makes: what it says, and the write, a label or a GraphQL mutation. */
type Change =
  | { readonly said: string; readonly label: string }
  | { readonly said: string; readonly query: string; readonly values: Record<string, unknown> };

const UPDATE = `mutation($field:ID!,$options:[ProjectV2SingleSelectFieldOptionInput!]!){updateProjectV2Field(input:{fieldId:$field,singleSelectOptions:$options}){clientMutationId}}`;
const CREATE = `mutation($board:ID!,$name:String!,$options:[ProjectV2SingleSelectFieldOptionInput!]!){createProjectV2Field(input:{projectId:$board,dataType:SINGLE_SELECT,name:$name,singleSelectOptions:$options}){clientMutationId}}`;

/** The field's change: create it whole, or add the options it lacks, keeping each it has by id. */
function fieldChange(at: Health, board: string, name: "Status" | "Priority"): Change[] {
  const { field, missing } = fieldGap(at, name);
  const wanted = definitions()[name];
  const added = wanted
    .filter((d) => missing.includes(d.name))
    .map((d) => ({ ...d, color: "GRAY" }));
  const listed = added.map((a) => a.name).join(", ");
  if (field === undefined) {
    const values = { board, name, options: added };
    return [{ said: `created field ${name} with ${listed}`, query: CREATE, values }];
  }
  const values = { field: field.id, options: [...field.options, ...added] };
  return added.length === 0 ? [] : [{ said: `added to ${name}: ${listed}`, query: UPDATE, values }];
}

/** What the flow needs minus what the board and the repository hold; none once setup has run. */
export function changes(at: Health, board: string): Change[] {
  return [
    ...fieldChange(at, board, "Status"),
    ...fieldChange(at, board, "Priority"),
    ...LABELS.filter((l) => !at.labels.includes(l)).map((label) => ({
      said: `created label ${label}`,
      label,
    })),
  ];
}
