// Setting the Status of an issue on the board it is on.
import { isRecord } from "../../../lib/outcome.ts";
import { QsmError } from "../../../lib/qsm-error.ts";
import { runGh } from "./gh.ts";

const QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      projectItems(first: 10) {
        nodes {
          id
          project {
            id
            title
            field(name: "Status") {
              ... on ProjectV2SingleSelectField { id options { id name } }
            }
          }
        }
      }
    }
  }
}`;

const MUTATION =
  "mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) { updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }) { projectV2Item { id } } }";

export interface Target {
  readonly projectId: string;
  readonly itemId: string;
  readonly fieldId: string;
  readonly optionId: string;
}

function child(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function shape(path: string, wanted: string): QsmError {
  return new QsmError("failed", `gh api graphql: ${path} is not ${wanted}`);
}

function textAt(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw shape(path, "text");
  }
  return value;
}

function listAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw shape(path, "a list");
  }
  return value;
}

/** Where to set the Status `status` of issue `number`, from the answer of the board query. */
export function targetOf(stdout: string, number: number, status: string): Target {
  const root: unknown = JSON.parse(stdout);
  const issue = child(child(child(root, "data"), "repository"), "issue");
  const nodes = listAt(child(child(issue, "projectItems"), "nodes"), "projectItems.nodes");
  if (nodes.length === 0) {
    throw new QsmError("failed", `issue #${number} is on no board`);
  }
  if (nodes.length > 1) {
    const titles = nodes.map((node) => String(child(child(node, "project"), "title")));
    throw new QsmError("failed", `issue #${number} is on several boards: ${titles.join(", ")}`);
  }
  const node: unknown = nodes[0];
  const project = child(node, "project");
  const field = child(project, "field");
  const options = listAt(child(field, "options"), "field.options").map((option, i) => ({
    id: textAt(child(option, "id"), `options[${i}].id`),
    name: textAt(child(option, "name"), `options[${i}].name`),
  }));
  const chosen = options.find((option) => option.name === status);
  if (chosen === undefined) {
    const names = options.map((option) => option.name).join(", ");
    throw new QsmError("failed", `Status ${status} is not on the board; its Statuses: ${names}`);
  }
  return {
    projectId: textAt(child(project, "id"), "project.id"),
    itemId: textAt(child(node, "id"), "node.id"),
    fieldId: textAt(child(field, "id"), "field.id"),
    optionId: chosen.id,
  };
}

/** Sets the Status of issue `number` to the board option named exactly `status`. */
export function moveIssue(number: number, status: string): void {
  const target = targetOf(
    runGh([
      "api",
      "graphql",
      "-F",
      "owner={owner}",
      "-F",
      "repo={repo}",
      "-F",
      `number=${number}`,
      "-f",
      `query=${QUERY}`,
    ]),
    number,
    status,
  );
  runGh([
    "api",
    "graphql",
    "-f",
    `projectId=${target.projectId}`,
    "-f",
    `itemId=${target.itemId}`,
    "-f",
    `fieldId=${target.fieldId}`,
    "-f",
    `optionId=${target.optionId}`,
    "-f",
    `query=${MUTATION}`,
  ]);
}
