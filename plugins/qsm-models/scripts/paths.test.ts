// paths through the real entry. The expected ids are the prototype walker's on the same file.
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { envelopeOf, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { CLI, PLAN } from "./fixtures/plan.ts";

function paths(xml: string, ...args: string[]): { exit: number; message: string } {
  const dir = sandboxDir("qsm-models-paths-");
  writeIn(dir, "shop.bpmn", xml);
  const run = runBin(CLI, ["paths", join(dir, "shop.bpmn"), ...args, "--json"]);
  return { exit: run.exit, message: envelopeOf(run.stdout).message };
}

const ids = (message: string): string[] =>
  [...message.matchAll(/^p-[0-9a-f]{6}/gm)].map((m) => m[0]);

describe("paths", () => {
  it("prints the cover of each process, the same ids on every run", () => {
    const first = paths(PLAN);
    expect(first.exit).toBe(0);
    expect(ids(first.message)).toEqual(["p-60dd67", "p-3f29e4"]);
    expect(ids(paths(PLAN).message)).toEqual(["p-60dd67", "p-3f29e4"]);
  });

  it("prints every path under --all, each with its signature", () => {
    const run = paths(PLAN, "--all", "--process", "plan");
    expect(ids(run.message)).toEqual(["p-6b62bb", "p-60dd67", "p-347235", "p-3f29e4"]);
    expect(run.message).toContain("p-3f29e4  Plan approved? dropped; -> Feature not planned");
  });

  it("refuses a step that has no way out and is no end event", () => {
    const xml = PLAN.replace(
      '<bpmn:sequenceFlow id="f_close_dropped" sourceRef="close" targetRef="dropped" />',
      '<bpmn:sequenceFlow id="f_close_dropped" sourceRef="dropped" targetRef="dropped" />',
    );
    const run = paths(xml);
    expect(run.exit).toBe(3);
    expect(run.message).toContain('"2.10 Close the feature as not planned" has no way out');
  });

  it("names under --specs each cover path no scenario cites and each cited id that is no path", () => {
    const dir = sandboxDir("qsm-models-specs-");
    writeIn(
      dir,
      "x/spec.md",
      "#### Scenario: approved (path p-60dd67)\n#### Scenario: gone (path p-000000)\n",
    );
    const run = paths(PLAN, "--specs", dir);
    expect(run.exit).toBe(3);
    expect(run.message).toContain("p-3f29e4 of plan_process");
    expect(run.message).toContain("p-000000, cited in");
    expect(run.message).not.toContain("p-60dd67 of plan_process");
  });
});
