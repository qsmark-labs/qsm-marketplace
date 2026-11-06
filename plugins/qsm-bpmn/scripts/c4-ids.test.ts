// The C4 link through the real entry: a graph that carries no C4 id runs every verb without
// qsm-c4, and one that carries an id reads it through qsm-c4's CLI, a shim of its real entry on
// PATH, or fails missing without it.
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { binPath } from "../../../lib/outcome.ts";
import { bareRuntimePath, cliShim } from "../../../lib/fixtures/bin.ts";
import { envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { repoWith } from "../../../lib/fixtures/git.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { CLI, PLAN } from "./fixtures/plan.ts";

const C4 = readFileSync(resolve(import.meta.dir, "../../../models/marketplace.c4"), "utf8");
const QSM_C4 = resolve(import.meta.dir, "../../qsm-c4/scripts/cli.ts");
const NS = 'xmlns:c4="https://c4model.com" ';
const TASK = '<bpmn:task id="plan_process_context" name="2.1 Gather the context">';
const AGENT = '<bpmn:lane id="plan_process_lane_1" name="Agent">';
/** The planning process alone: its call activity calls itself, the one process of this file. */
const ALONE = PLAN.replace('calledElement="model_gate_process"', 'calledElement="plan_process"');
const UNDRAWN = /\s*<bpmndi:BPMNDiagram[\s\S]*<\/bpmndi:BPMNDiagram>/;

/** The planning process with `attrs` added to the element `open` starts. */
const linked = (open: string, attrs: string, xml = ALONE): string =>
  xml.replace("xmlns:bioc=", `${NS}xmlns:bioc=`).replace(open, open.replace(">", ` ${attrs}>`));

/** PATH with the runtime and git only: no qsm-c4. */
const withoutC4 = (): Record<string, string> =>
  isolatedEnv(sandboxDir("qsm-bpmn-home-"), {
    PATH: `${bareRuntimePath()}:${dirname(binPath("git") ?? "/usr/bin/git")}`,
  });

/** PATH with qsm-c4 as a shim of its real entry in front. */
function withC4(): Record<string, string> {
  const bin = sandboxDir("qsm-bpmn-bin-");
  cliShim(bin, "qsm-c4", QSM_C4);
  return isolatedEnv(sandboxDir("qsm-bpmn-home-"), { PATH: `${bin}:${process.env.PATH ?? ""}` });
}

describe("a process with no C4 ids", () => {
  it("runs lint, layout, render, paths and pages with no qsm-c4 on PATH", () => {
    const { repo } = repoWith("qsm-bpmn-alone-", {
      "models/shop.bpmn": ALONE,
      "undrawn/shop.bpmn": ALONE.replace(UNDRAWN, ""),
    });
    const env = withoutC4();
    for (const args of [
      ["lint", "models"],
      ["layout", "undrawn/shop.bpmn"],
      ["render", "models"],
      ["paths", "models"],
      ["pages"],
    ]) {
      expect({ args, exit: runBin(CLI, args, { cwd: repo, env }).exit }).toEqual({ args, exit: 0 });
    }
  });
});

describe("a C4 id and no qsm-c4", () => {
  it("is missing qsm-c4 and writes nothing", () => {
    const dir = sandboxDir("qsm-bpmn-missing-");
    writeIn(dir, "shop.bpmn", linked(AGENT, 'c4:element="qa"'));
    const run = runBin(CLI, ["lint", join(dir, "shop.bpmn"), "--json"], { env: withoutC4() });
    expect(run.exit).toBe(4);
    expect(envelopeOf(run.stdout).message).toContain("qsm-c4 is not on PATH");
    expect(readdirSync(dir)).toEqual(["shop.bpmn"]);
  });
});

describe("a link that no longer resolves", () => {
  it("names the task, the id and the missing element", () => {
    const dir = sandboxDir("qsm-bpmn-link-");
    writeIn(dir, "shop.bpmn", linked(TASK, 'c4:element="mp.taskz"'));
    writeIn(dir, "shop.c4", C4);
    const run = runBin(CLI, ["lint", join(dir, "shop.bpmn"), "--json"], { env: withC4() });
    expect(run.exit).toBe(3);
    expect(envelopeOf(run.stdout).message).toContain(
      'plan_process_context: c4:element="mp.taskz" names no element of the C4 graph (c4-element)',
    );
  });

  it("passes a link that resolves", () => {
    const dir = sandboxDir("qsm-bpmn-link-");
    writeIn(dir, "shop.bpmn", linked(TASK, 'c4:element="mp.tasks"'));
    writeIn(dir, "shop.c4", C4);
    expect(runBin(CLI, ["lint", join(dir, "shop.bpmn")], { env: withC4() }).exit).toBe(0);
  });

  it("names a c4 prefix bound to another namespace", () => {
    const dir = sandboxDir("qsm-bpmn-link-");
    const xml = linked(TASK, 'c4:element="mp.tasks"').replace(
      'xmlns:c4="https://c4model.com"',
      'xmlns:c4="https://c4model.org"',
    );
    writeIn(dir, "shop.bpmn", xml);
    const run = runBin(CLI, ["lint", join(dir, "shop.bpmn"), "--json"], { env: withoutC4() });
    expect(run.exit).toBe(3);
    expect(envelopeOf(run.stdout).message).toContain("(c4-namespace)");
  });
});

const shapeOf = (xml: string, id: string): string =>
  new RegExp(`<bpmndi:BPMNShape[^>]*bpmnElement="${id}"[^>]*>`).exec(xml)?.[0] ?? "";

describe("layout colours", () => {
  it("gives a linked lane its actor's colour and the other lane the first colour left", () => {
    const dir = sandboxDir("qsm-bpmn-lanes-");
    writeIn(dir, "shop.bpmn", linked(AGENT, 'c4:element="qa"', PLAN).replace(UNDRAWN, ""));
    writeIn(dir, "shop.c4", C4);
    expect(runBin(CLI, ["layout", join(dir, "shop.bpmn")], { env: withC4() }).exit).toBe(0);
    const xml = readFileSync(join(dir, "shop.bpmn"), "utf8");
    // QA agent is green in the C4 graph; position alone would have made the Agent lane purple
    expect(shapeOf(xml, "plan_process_lane_1")).toContain('bioc:stroke="#15803d"');
    expect(shapeOf(xml, "plan_process_lane_0")).toContain('bioc:stroke="#08427b"');
    // bpmn-moddle wrote the lane back with its link
    expect(xml).toContain(`${AGENT.slice(0, -1)} c4:element="qa">`);
    const lane = shapeOf(xml, "plan_process_lane_1");
    writeIn(dir, "shop.bpmn", xml.replace(lane, lane.replaceAll("#15803d", "#b91c1c")));
    const run = runBin(CLI, ["lint", join(dir, "shop.bpmn"), "--json"], { env: withC4() });
    expect(run.exit).toBe(3);
    expect(envelopeOf(run.stdout).message).toContain(
      "plan_process_lane_1: the lane links to qa, whose colour is #15803d, and is drawn in #b91c1c (lane-colour)",
    );
  });
});
