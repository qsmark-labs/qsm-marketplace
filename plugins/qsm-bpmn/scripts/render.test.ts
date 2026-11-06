// layout and render through the real binary entry: a graph on disk in, files and one envelope out.
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
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

/** The planning process with no diagram and the Agent lane linked to `link`. */
const undrawn = (link: string): string =>
  PLAN.replace("xmlns:bioc=", 'xmlns:qsm="urn:qsm:models" xmlns:bioc=')
    .replace(
      '<bpmn:lane id="plan_process_lane_1" name="Agent">',
      `<bpmn:lane id="plan_process_lane_1" name="Agent" qsm:c4="${link}">`,
    )
    .replace(/\s*<bpmndi:BPMNDiagram[\s\S]*<\/bpmndi:BPMNDiagram>/, "");

describe("render", () => {
  it("fails on a process that has no diagram, naming it and the verb that draws it", () => {
    const dir = sandboxDir("qsm-bpmn-undrawn-");
    writeIn(dir, "shop.bpmn", undrawn("qa"));
    const run = runBin(CLI, ["render", dir, "--json"]);
    expect(run.exit).toBe(1);
    expect(envelopeOf(run.stdout).message).toContain("process plan_process has no diagram");
  });
});

describe("render --check", () => {
  it("names the picture a changed graph made stale and writes nothing", () => {
    const dir = sandboxDir("qsm-bpmn-render-");
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
