import { expect } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Given, loadFeatures, runFeatures, Then, When } from "@questi0nm4rk/feats";
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
  input?: string;
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
  if (world.input !== undefined) {
    lines.push(`cat > "${dir}/stdin"`);
  }
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
Given("I pipe {string}", (world: World, input: unknown) => {
  world.input = unescaped(input);
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

When("I run {string}", (world: World, args: unknown) => {
  const mutant = process.env[MUTANT_VAR];
  const env = isolatedEnv(sandboxDir("qsm-tasks-home-"), {
    PATH: world.absent === true ? bareRuntimePath() : installGh(world),
    ...(mutant === undefined ? {} : { [MUTANT_VAR]: mutant }),
  });
  // words split on spaces; a 'quoted phrase' is one word
  const argv = (String(args).match(/'[^']*'|\S+/g) ?? []).map((w) =>
    w.startsWith("'") ? w.slice(1, -1) : w,
  );
  const run = runBin(CLI, argv, {
    env,
    cwd: sandboxDir("qsm-tasks-cwd-"),
    input: world.input ?? "",
  });
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
Then("gh received {string} on stdin", (world: World, input: unknown) => {
  expect(readFileSync(join(world.dir ?? "", "stdin"), "utf8")).toBe(unescaped(input));
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
