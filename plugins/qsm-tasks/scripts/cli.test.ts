// qsm-tasks through its real entry: argv in, one envelope or text out, against a fake gh.
// The behaviour is the Gherkin in features/; every row runs through the steps below.
import { expect } from "bun:test";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadFeatures, runFeatures, Then, When, Given } from "@questi0nm4rk/feats";
import { bareRuntimePath, fakeBin } from "../../../lib/fixtures/bin.ts";
import { envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";

const CLI = resolve(import.meta.dir, "cli.ts");
const FEATURES = resolve(import.meta.dir, "../features");

const MUTANT_VAR = "__STRYKER_ACTIVE_MUTANT__";
const GH_CALL = "issue list --state open --limit 1000 --json number,title,projectItems";

interface World {
  bin?: string;
  path?: string;
  stdout?: string;
  exit?: number;
}

function fakeGh(world: World, body: string): void {
  world.bin = sandboxDir("qsm-tasks-bin-");
  // gh answers only the one call the verb is specified to make
  fakeBin(
    world.bin,
    "gh",
    `[ "$*" = "${GH_CALL}" ] || { echo "unexpected gh call: $*" >&2; exit 2; }\n${body}`,
  );
  world.path = `${world.bin}:${process.env.PATH ?? ""}`;
}

function answer(world: World, raw: string): void {
  const file = join(sandboxDir("qsm-tasks-answer-"), "answer.json");
  writeFileSync(file, raw);
  fakeGh(world, `cat "${file}"`);
}

// the answer as gh gave it: one issue with a Status, one on the board with none set
Given("gh lists the recorded issues", (world: World) => {
  fakeGh(world, `cat "${join(FEATURES, "gh-issue-list.json")}"`);
});
Given("gh is {string}", (world: World, how: unknown) => {
  if (how === "absent") {
    world.path = bareRuntimePath();
  } else {
    fakeGh(world, "exit 0");
  }
});
Given("gh answers {string}", (world: World, raw: unknown) => {
  answer(world, String(raw));
});
Given(
  "gh is {string} printing {string} on stderr",
  (world: World, how: unknown, stderr: unknown) => {
    if (how === "absent") {
      world.path = bareRuntimePath();
    } else {
      fakeGh(world, `echo "${String(stderr)}" >&2\nexit 1`);
    }
  },
);

When("I run {string}", (world: World, args: unknown) => {
  // StrykerJS names the mutant to switch on in this variable; the CLI child must see it, or no
  // mutant in the code it runs is ever active.
  const mutant = process.env[MUTANT_VAR];
  const env = isolatedEnv(sandboxDir("qsm-tasks-home-"), {
    PATH: world.path ?? "",
    ...(mutant === undefined ? {} : { [MUTANT_VAR]: mutant }),
  });
  const run = runBin(CLI, String(args).split(" "), { env, cwd: sandboxDir("qsm-tasks-cwd-") });
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
Then(
  "it ends {string} with exit {int} saying {string}",
  (world: World, code: unknown, exit: unknown, said: unknown) => {
    const envelope = envelopeOf(world.stdout ?? "");
    expect([envelope.code as string, world.exit]).toEqual([String(code), Number(exit)]);
    expect(envelope.message).toContain(String(said));
  },
);

runFeatures(await loadFeatures("*.feature", { cwd: FEATURES }));
