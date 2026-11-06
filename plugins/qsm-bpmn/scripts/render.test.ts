// layout and render through the real binary entry: a graph on disk in, files and one envelope out.
import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { envelopeOf, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { CLI, PLAN } from "./fixtures/plan.ts";

describe("layout", () => {
  it("refuses a file the owner drew and leaves it unchanged", () => {
    const dir = sandboxDir("qsm-bpmn-layout-");
    writeIn(dir, "shop.bpmn", PLAN);
    const run = runBin(CLI, ["layout", join(dir, "shop.bpmn"), "--json"]);
    expect(run.exit).toBe(5);
    expect(envelopeOf(run.stdout).message).toContain("has a layout");
    expect(readFileSync(join(dir, "shop.bpmn"), "utf8")).toBe(PLAN);
  });
});

/** The planning process rendered into a fresh directory: the directory, its picture and the
 * picture's bytes. */
function rendered(prefix: string): { dir: string; picture: string; before: string } {
  const dir = sandboxDir(prefix);
  writeIn(dir, "shop.bpmn", PLAN);
  expect(runBin(CLI, ["render", dir]).exit).toBe(0);
  const picture = join(dir, "shop.plan_process.svg");
  return { dir, picture, before: readFileSync(picture, "utf8") };
}

describe("render", () => {
  it("refuses a process that has no diagram through lint, naming no-bpmndi", () => {
    const dir = sandboxDir("qsm-bpmn-undrawn-");
    writeIn(
      dir,
      "shop.bpmn",
      PLAN.replace(/\s*<bpmndi:BPMNDiagram[\s\S]*<\/bpmndi:BPMNDiagram>/, ""),
    );
    const run = runBin(CLI, ["render", dir, "--json"]);
    expect(run.exit).toBe(3);
    expect(envelopeOf(run.stdout).message).toContain("(no-bpmndi)");
    expect(readdirSync(dir)).toEqual(["shop.bpmn"]);
  });

  it("writes nothing for a graph with an unlabelled split answer", () => {
    const { dir, picture, before } = rendered("qsm-bpmn-refused-");
    writeIn(
      dir,
      "shop.bpmn",
      PLAN.replace('id="f_verdict_commit" name="yes"', 'id="f_verdict_commit"'),
    );
    const run = runBin(CLI, ["render", dir, "--json"]);
    expect(run.exit).toBe(3);
    expect(envelopeOf(run.stdout).message).toContain("f_verdict_commit");
    expect(envelopeOf(run.stdout).message).toContain("(split-flows-labelled)");
    expect(readFileSync(picture, "utf8")).toBe(before);
  });
});

describe("render --check", () => {
  it("names the picture a changed graph made stale and writes nothing", () => {
    const { dir, picture, before } = rendered("qsm-bpmn-render-");
    expect(runBin(CLI, ["render", dir, "--check"]).exit).toBe(0);
    writeIn(dir, "shop.bpmn", PLAN.replace("2.1 Gather the context", "2.1 Gather all the context"));
    const run = runBin(CLI, ["render", dir, "--check", "--json"]);
    expect(run.exit).toBe(3);
    expect(envelopeOf(run.stdout).message).toContain("shop.plan_process.svg");
    expect(readFileSync(picture, "utf8")).toBe(before);
  });

  it("names a picture no render would write, and neither render nor --check deletes it", () => {
    const dir = sandboxDir("qsm-bpmn-orphan-");
    writeIn(dir, "shop.bpmn", PLAN);
    expect(runBin(CLI, ["render", dir]).exit).toBe(0);
    writeIn(dir, "shop.gone_process.svg", "<svg/>");
    writeIn(dir, "other.keep.svg", "<svg/>");
    for (const args of [
      ["render", dir, "--check", "--json"],
      ["render", dir, "--json"],
    ]) {
      const run = runBin(CLI, args);
      expect(run.exit).toBe(3);
      expect(envelopeOf(run.stdout).message).toContain("shop.gone_process.svg");
      expect(envelopeOf(run.stdout).message).not.toContain("other.keep.svg");
    }
    expect(existsSync(join(dir, "shop.gone_process.svg"))).toBe(true);
    expect(existsSync(join(dir, "other.keep.svg"))).toBe(true);
  });
});
