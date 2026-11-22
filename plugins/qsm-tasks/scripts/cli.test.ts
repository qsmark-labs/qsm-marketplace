// qsm-tasks through its real entry: argv in, one envelope or text out, against a fake gh.
// The behaviour is the Gherkin in features/; every row runs through the steps below.
import { expect } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Given, loadFeatures, runFeatures, Then, When } from "@questi0nm4rk/feats";
import { isRecord } from "../../../lib/outcome.ts";
import { bareRuntimePath, fakeBin } from "../../../lib/fixtures/bin.ts";
import { envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";

const CLI = resolve(import.meta.dir, "cli.ts");
const FEATURES = resolve(import.meta.dir, "../features");

const MUTANT_VAR = "__STRYKER_ACTIVE_MUTANT__";
const LIST_ARGS = [
  "issue",
  "list",
  "--state",
  "open",
  "--limit",
  "1000",
  "--json",
  "number,title,projectItems",
];

/** One call the fake gh accepts, exactly, and what it answers. */
interface Call {
  readonly name: string;
  readonly args: readonly string[];
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exit?: number;
}

interface World {
  calls?: Call[];
  absent?: boolean;
  dir?: string;
  stdout?: string;
  exit?: number;
}

/** A step's text with its `\n` written as the line break gh prints. */
function unescaped(text: unknown): string {
  return String(text).replaceAll(String.raw`\n`, "\n");
}

function accept(world: World, call: Call): void {
  world.calls = [...(world.calls ?? []), call];
}

/** A gh on PATH that answers the accepted calls, byte for byte on its arguments, logs the name of
 * each call it got, and refuses every other call with exit 2. Returns the PATH. */
function installGh(world: World): string {
  const dir = sandboxDir("qsm-tasks-gh-");
  world.dir = dir;
  const lines = [`printf '%s\\n' "$@" > "${dir}/got"`];
  (world.calls ?? []).forEach((call, i) => {
    writeFileSync(join(dir, `${i}.args`), call.args.map((a) => `${a}\n`).join(""));
    writeFileSync(join(dir, `${i}.out`), call.stdout ?? "");
    writeFileSync(join(dir, `${i}.err`), call.stderr ?? "");
    lines.push(
      `if cmp -s "${dir}/got" "${dir}/${i}.args"; then echo "${call.name}" >> "${dir}/log"; cat "${dir}/${i}.out"; cat "${dir}/${i}.err" >&2; exit ${call.exit ?? 0}; fi`,
    );
  });
  lines.push('echo "unexpected gh call: $*" >&2', "exit 2");
  fakeBin(dir, "gh", lines.join("\n"));
  return `${dir}:${process.env.PATH ?? ""}`;
}

Given("gh is {string}", (world: World, how: unknown) => {
  world.absent = how === "absent";
});
// the answer as gh gave it: one issue with a Status, one on the board with none set
Given("gh lists the recorded issues", (world: World) => {
  const stdout = readFileSync(join(FEATURES, "gh-issue-list.json"), "utf8");
  accept(world, { name: "list", args: LIST_ARGS, stdout });
});
Given("gh answers {string}", (world: World, raw: unknown) => {
  accept(world, { name: "list", args: LIST_ARGS, stdout: String(raw) });
});
Given(
  "gh is {string} printing {string} on stderr",
  (world: World, how: unknown, stderr: unknown) => {
    world.absent = how === "absent";
    accept(world, { name: "list", args: LIST_ARGS, stderr: String(stderr), exit: 1 });
  },
);
Given(
  "gh creates the issue titled {string} from {string} and prints {string}",
  (world: World, title: unknown, file: unknown, out: unknown) => {
    const args = ["issue", "create", "--title", String(title), "--body-file", String(file)];
    accept(world, { name: "create", args, stdout: unescaped(out) });
  },
);
Given(
  "gh gives the id {string} of issue {string}",
  (world: World, id: unknown, number: unknown) => {
    const args = ["api", `repos/{owner}/{repo}/issues/${String(number)}`, "--jq", ".id"];
    accept(world, { name: "id", args, stdout: unescaped(id) });
  },
);
Given(
  "gh accepts the sub-issue id {string} under issue {string}",
  (world: World, id: unknown, parent: unknown) => {
    const args = [
      "api",
      "-X",
      "POST",
      `repos/{owner}/{repo}/issues/${String(parent)}/sub_issues`,
      "-F",
      `sub_issue_id=${String(id)}`,
    ];
    accept(world, { name: "sub-issue", args });
  },
);

/** The value at `path` in parsed JSON; undefined when any step is missing. */
function dig(value: unknown, ...path: (string | number)[]): unknown {
  let at = value;
  for (const key of path) {
    at = Array.isArray(at) ? (at as unknown[])[Number(key)] : isRecord(at) ? at[key] : undefined;
  }
  return at;
}

function textOf(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("the recorded answer lacks a text field");
  }
  return value;
}

// The recorded board query answer; only its three node ids (item, project, Status field) are stand-ins.
const BOARD = JSON.parse(readFileSync(join(FEATURES, "gh-move-query.json"), "utf8")) as unknown;
const NODE = dig(BOARD, "data", "repository", "issue", "projectItems", "nodes", 0);
const BOARD_QUERY = readFileSync(join(FEATURES, "move-query.graphql"), "utf8").trimEnd();
const MUTATION =
  "mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) { updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }) { projectV2Item { id } } }";

function boardQuery(number: unknown, stdout: string): Call {
  const args = ["api", "graphql", "-F", "owner={owner}", "-F", "repo={repo}"];
  return {
    name: "board",
    args: [...args, "-F", `number=${String(number)}`, "-f", `query=${BOARD_QUERY}`],
    stdout,
  };
}

Given(
  "gh answers the board query of issue {string} with the recorded board {string}",
  (world: World, number: unknown, titles: unknown) => {
    const boards = String(titles) === "" ? [] : String(titles).split(",");
    const node = isRecord(NODE) ? NODE : {};
    const project = dig(NODE, "project");
    const nodes = boards.map((title) => ({
      ...node,
      project: { ...(isRecord(project) ? project : {}), title },
    }));
    const answer = { data: { repository: { issue: { projectItems: { nodes } } } } };
    accept(world, boardQuery(number, JSON.stringify(answer)));
  },
);
Given(
  "gh answers the board query of issue {string} with {string}",
  (world: World, number: unknown, raw: unknown) => {
    accept(world, boardQuery(number, String(raw)));
  },
);
Given(
  "gh sets the Status {string} on the recorded board and answers {string}",
  (world: World, status: unknown, stderr: unknown) => {
    const options = dig(NODE, "project", "field", "options");
    const option = Array.isArray(options)
      ? (options as unknown[]).find((o) => dig(o, "name") === status)
      : undefined;
    accept(world, {
      name: "mutation",
      args: [
        "api",
        "graphql",
        "-f",
        `projectId=${textOf(dig(NODE, "project", "id"))}`,
        "-f",
        `itemId=${textOf(dig(NODE, "id"))}`,
        "-f",
        `fieldId=${textOf(dig(NODE, "project", "field", "id"))}`,
        "-f",
        `optionId=${textOf(dig(option, "id"))}`,
        "-f",
        `query=${MUTATION}`,
      ],
      stderr: String(stderr),
      exit: String(stderr) === "" ? 0 : 1,
    });
  },
);

When("I run {string}", (world: World, args: unknown) => {
  // StrykerJS names the mutant to switch on in this variable; the CLI child must see it, or no
  // mutant in the code it runs is ever active.
  const mutant = process.env[MUTANT_VAR];
  const env = isolatedEnv(sandboxDir("qsm-tasks-home-"), {
    PATH: world.absent === true ? bareRuntimePath() : installGh(world),
    ...(mutant === undefined ? {} : { [MUTANT_VAR]: mutant }),
  });
  // words split on spaces; a 'quoted phrase' is one word
  const argv = (String(args).match(/'[^']*'|\S+/g) ?? []).map((w) =>
    w.startsWith("'") ? w.slice(1, -1) : w,
  );
  const run = runBin(CLI, argv, { env, cwd: sandboxDir("qsm-tasks-cwd-") });
  world.stdout = run.stdout;
  world.exit = run.exit;
});

Then(
  "issue {string} prints status {string} and title {string}",
  (world: World, number: unknown, status: unknown, title: unknown) => {
    const line = `#${String(number)}\t${String(status)}\t${String(title)}`;
    expect(world.stdout?.split("\n")).toContain(line);
  },
);
Then(
  "the data of issue {string} has status {string}",
  (world: World, number: unknown, status: unknown) => {
    expect(envelopeOf(world.stdout ?? "").data).toContainEqual(
      expect.objectContaining({
        number: Number(number),
        status: status === "null" ? null : status,
      }),
    );
  },
);
Then("the data is the number {int}", (world: World, number: unknown) => {
  expect(envelopeOf(world.stdout ?? "").data).toBe(Number(number));
});
Then("gh received {string}", (world: World, name: unknown) => {
  expect(readFileSync(join(world.dir ?? "", "log"), "utf8").split("\n")).toContain(String(name));
});
Then(
  "it ends {string} with exit {int} saying {string}",
  (world: World, code: unknown, exit: unknown, said: unknown) => {
    const envelope = envelopeOf(world.stdout ?? "");
    expect([envelope.code as string, world.exit]).toEqual([String(code), Number(exit)]);
    expect(envelope.message).toContain(String(said));
  },
);

runFeatures(await loadFeatures("*.feature", { cwd: FEATURES }));
