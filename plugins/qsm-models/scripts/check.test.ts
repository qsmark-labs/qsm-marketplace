// check through the real entry, in a throwaway repository holding the real planning process, the
// marketplace's C4 source and this change's design.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { envelopeOf, runBin } from "../../../lib/fixtures/cli.ts";
import { git, repoWith } from "../../../lib/fixtures/git.ts";
import { writeIn } from "../../../lib/fixtures/sandbox.ts";
import { C4, CLI, GRAPH, PLAN } from "./fixtures/plan.ts";

const ROOT = resolve(import.meta.dir, "../../..");
const DESIGN_PATH = "openspec/changes/strict-visual-models/design.md";
const DESIGN = readFileSync(join(ROOT, DESIGN_PATH), "utf8");
const NS = 'xmlns:qsm="urn:qsm:models" ';
const TASK = '<bpmn:task id="plan_process_context" name="2.1 Gather the context">';
/** The planning process alone: its call activity calls a process this file lacks, so it calls
 * itself here. */
const ALONE = PLAN.replace('calledElement="model_gate_process"', 'calledElement="plan_process"');

/** The planning process with link attributes on its first task. */
const linked = (attrs: string): string =>
  ALONE.replace("xmlns:bioc=", `${NS}xmlns:bioc=`).replace(TASK, TASK.replace(">", ` ${attrs}>`));

function check(
  bpmn: string,
  extra: Record<string, string> = {},
): { exit: number; message: string; repo: string } {
  const { repo } = repoWith("qsm-models-check-", {
    "models/shop.bpmn": bpmn,
    "models/shop.c4": C4,
    [DESIGN_PATH]: DESIGN,
    ...extra,
  });
  const run = runBin(CLI, ["check", "--json"], { cwd: repo });
  return { exit: run.exit, message: envelopeOf(run.stdout).message, repo };
}

describe("check", () => {
  it("passes the marketplace's one graph of each kind", () => {
    expect(check(GRAPH).exit).toBe(0);
  });

  it("fails naming models/ where neither graph exists", () => {
    const { repo } = repoWith("qsm-models-check-", { "README.md": "x" });
    const run = runBin(CLI, ["check", "--json"], { cwd: repo });
    expect(run.exit).toBe(1);
    expect(envelopeOf(run.stdout).message).toContain("models/ holds no graph");
  });

  it("finds models/ of the checkout from a subdirectory for lint and paths", () => {
    const { repo } = repoWith("qsm-models-check-", {
      "models/shop.bpmn": GRAPH,
      "sub/README.md": "x",
    });
    const sub = join(repo, "sub");
    for (const args of [["lint"], ["paths", "--all"]]) {
      expect(runBin(CLI, args, { cwd: sub }).exit).toBe(0);
    }
  });

  it("passes a process with no links", () => {
    expect(check(ALONE).exit).toBe(0);
  });

  it("names a call activity that calls a process the graph lacks", () => {
    const r = check(PLAN);
    expect(r.exit).toBe(3);
    expect(r.message).toContain(
      "models: calls model_gate_process, which is no process of this graph",
    );
  });

  it("passes a C4 link and a decision link that resolve", () => {
    const r = check(linked(`qsm:c4="mp.models" qsm:decision="design:${DESIGN_PATH}#3"`));
    expect(r).toMatchObject({ exit: 0 });
  });

  it("names the task, the link and the missing C4 element", () => {
    const r = check(linked('qsm:c4="mp.taskz"'));
    expect(r.exit).toBe(3);
    expect(r.message).toContain('plan_process_context: qsm:c4="mp.taskz" names no element of');
  });

  it("names a link attribute under a namespace the tool does not read", () => {
    const r = check(
      linked('qsm:c4="mp.models"').replace(
        'xmlns:qsm="urn:qsm:models"',
        'xmlns:qsm="urn:qsm:model"',
      ),
    );
    expect(r.exit).toBe(3);
    expect(r.message).toContain(
      "plan_process_context: qsm:c4 is under urn:qsm:model, not urn:qsm:models",
    );
  });

  it("names the node, the file and a number the design lacks", () => {
    const r = check(linked(`qsm:decision="design:${DESIGN_PATH}#99"`));
    expect(r.exit).toBe(3);
    expect(r.message).toContain(
      `plan_process_context: qsm:decision="design:${DESIGN_PATH}#99": ${DESIGN_PATH} has no numbered item 99`,
    );
  });

  it("resolves a commit link to a commit of the repository and refuses one it lacks", () => {
    const own = check(ALONE);
    const head = git(own.repo, "rev-parse", "HEAD");
    writeIn(own.repo, "models/shop.bpmn", linked(`qsm:decision="commit:${head}"`));
    expect(runBin(CLI, ["check"], { cwd: own.repo }).exit).toBe(0);
    const r = check(linked('qsm:decision="commit:deadbee"'));
    expect(r.exit).toBe(3);
    expect(r.message).toContain("commit deadbee is not in this repository");
  });

  it("names a change's own model file and the graph the change edits", () => {
    const r = check(ALONE, { "openspec/changes/x/models/y.bpmn": PLAN });
    expect(r.exit).toBe(3);
    expect(r.message).toContain(
      "openspec/changes/x/models/y.bpmn is a model outside models/: the change edits models/shop.bpmn",
    );
  });

  it("is missing qsm-docs for a call into another project", () => {
    const r = check(
      ALONE.replace('calledElement="plan_process"', 'calledElement="shop:plan_process"'),
    );
    expect(r.exit).toBe(4);
    expect(r.message).toContain("qsm-docs");
  });

  it("keeps a qsm:c4 link through a write by bpmn-moddle", () => {
    const xml = linked('qsm:c4="mp.taskz"').replace(
      /\s*<bpmndi:BPMNDiagram[\s\S]*<\/bpmndi:BPMNDiagram>/,
      "",
    );
    const { repo } = repoWith("qsm-models-moddle-", {
      "models/shop.bpmn": xml,
      "models/shop.c4": C4,
    });
    expect(runBin(CLI, ["layout", join(repo, "models/shop.bpmn")]).exit).toBe(0);
    const written = readFileSync(join(repo, "models/shop.bpmn"), "utf8");
    expect(written).toContain('qsm:c4="mp.taskz"');
    expect(written).toContain("<bpmndi:BPMNDiagram");
    expect(envelopeOf(runBin(CLI, ["check", "--json"], { cwd: repo }).stdout).message).toContain(
      'qsm:c4="mp.taskz"',
    );
  });
});
