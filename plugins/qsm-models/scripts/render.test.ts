// layout and render through the real binary entry: a graph on disk in, files and one envelope out.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { envelopeOf, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";

const CLI = resolve(import.meta.dir, "cli.ts");
const PLAN = readFileSync(resolve(import.meta.dir, "fixtures/plan.bpmn"), "utf8");

describe("layout", () => {
  it("refuses a file the owner drew and leaves it unchanged", () => {
    const dir = sandboxDir("qsm-models-layout-");
    writeIn(dir, "shop.bpmn", PLAN);
    const run = runBin(CLI, ["layout", join(dir, "shop.bpmn"), "--json"]);
    expect(run.exit).toBe(5);
    expect(envelopeOf(run.stdout).message).toContain("has a layout");
    expect(readFileSync(join(dir, "shop.bpmn"), "utf8")).toBe(PLAN);
  });
});

describe("render --check", () => {
  it("names the picture a changed graph made stale and writes nothing", () => {
    const dir = sandboxDir("qsm-models-render-");
    writeIn(dir, "shop.bpmn", PLAN);
    expect(runBin(CLI, ["render", dir]).exit).toBe(0);
    const picture = join(dir, "shop.plan_process.svg");
    const before = readFileSync(picture, "utf8");
    expect(runBin(CLI, ["render", dir, "--check"]).exit).toBe(0);
    writeIn(dir, "shop.bpmn", PLAN.replace("2.1 Gather the context", "2.1 Gather all the context"));
    const run = runBin(CLI, ["render", dir, "--check", "--json"]);
    expect(run.exit).toBe(3);
    expect(envelopeOf(run.stdout).message).toContain("shop.plan_process.svg");
    expect(readFileSync(picture, "utf8")).toBe(before);
  });
});
