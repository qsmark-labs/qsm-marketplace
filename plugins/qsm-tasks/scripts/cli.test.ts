// qsm-tasks through its real entry: argv in, one envelope out, against a fake gh.
// The behaviour is the Gherkin in features/; every row runs through the steps below.
import { expect } from "bun:test";
import { resolve } from "node:path";
import { Given, loadFeatures, runFeatures, Then, When } from "@questi0nm4rk/feats";
import { bareRuntimePath, fakeBin } from "../../../lib/fixtures/bin.ts";
import { envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";

const CLI = resolve(import.meta.dir, "cli.ts");
const FEATURES = resolve(import.meta.dir, "../features");

const MUTANT_VAR = "__STRYKER_ACTIVE_MUTANT__";

interface World {
  path?: string;
  stdout?: string;
  exit?: number;
}

Given("gh is {string}", (world: World, how: unknown) => {
  if (how === "absent") {
    world.path = bareRuntimePath();
  } else {
    const bin = sandboxDir("qsm-tasks-bin-");
    fakeBin(bin, "gh", "exit 0");
    world.path = `${bin}:${process.env.PATH ?? ""}`;
  }
});

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
  "it ends {string} with exit {int} saying {string}",
  (world: World, code: unknown, exit: unknown, said: unknown) => {
    const envelope = envelopeOf(world.stdout ?? "");
    expect([envelope.code as string, world.exit]).toEqual([String(code), Number(exit)]);
    expect(envelope.message).toContain(String(said));
  },
);

runFeatures(await loadFeatures("*.feature", { cwd: FEATURES }));
