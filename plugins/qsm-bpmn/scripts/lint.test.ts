// qsm-bpmn lint through its real surface: a graph on disk in, one envelope out. Each fixture
// is the real planning process with one change that breaks one rule.
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { findingsOf, type PrintedFinding, runBin } from "../../../lib/fixtures/cli.ts";
import { repoWith } from "../../../lib/fixtures/git.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { CLI, GRAPH, PLAN } from "./fixtures/plan.ts";

/** Lints `text` as a file named `name` and returns the exit and the findings. */
function lint(text: string, name = "plan.bpmn"): { exit: number; findings: PrintedFinding[] } {
  const dir = sandboxDir("qsm-bpmn-lint-");
  writeIn(dir, name, text);
  const run = runBin(CLI, ["lint", join(dir, name), "--json"]);
  return { exit: run.exit, findings: findingsOf(run.stdout) };
}

/** The planning process with `from` replaced by `to`, which must be there. */
function plan(...edits: [string, string][]): string {
  return edits.reduce((xml, [from, to]) => {
    expect(xml).toContain(from);
    return xml.replace(from, to);
  }, PLAN);
}

const rulesOf = (fs: PrintedFinding[], id: string): string[] =>
  fs.filter((f) => f.id === id).map((f) => f.rule);

describe("lint", () => {
  it("passes the marketplace's one graph", () => {
    expect(lint(GRAPH, "marketplace.bpmn")).toEqual({ exit: 0, findings: [] });
  });

  it("refuses a split after a call activity whose answer is no end of the called process", () => {
    const graph = GRAPH.replace(
      '<bpmn:endEvent id="plan_process_dropped" name="Feature not planned">',
      '<bpmn:endEvent id="plan_process_dropped" name="Feature dropped">',
    );
    expect(graph).not.toBe(GRAPH);
    const r = lint(graph, "marketplace.bpmn");
    expect(r.exit).toBe(3);
    expect(rulesOf(r.findings, "f_planned_dropped")).toEqual(["split-after-call"]);
  });

  it("passes the planning process of the marketplace graph", () => {
    expect(lint(PLAN)).toEqual({ exit: 0, findings: [] });
  });

  it("refuses an unlabelled answer of a split, naming the flow", () => {
    const r = lint(plan(['id="f_verdict_commit" name="yes"', 'id="f_verdict_commit"']));
    expect(r.exit).toBe(3);
    expect(rulesOf(r.findings, "f_verdict_commit")).toContain("split-flows-labelled");
  });

  it("refuses a complex gateway as outside the Analytic sub-class", () => {
    const r = lint(
      plan(
        [
          '<bpmn:exclusiveGateway id="plan_process_verdict" name="Plan approved?">',
          '<bpmn:complexGateway id="plan_process_verdict" name="Plan approved?">',
        ],
        [
          '</bpmn:exclusiveGateway>\n    <bpmn:callActivity id="plan_process_record"',
          '</bpmn:complexGateway>\n    <bpmn:callActivity id="plan_process_record"',
        ],
      ),
    );
    expect(r.exit).toBe(3);
    expect(rulesOf(r.findings, "plan_process_verdict")).toContain("analytic-only");
  });

  it("refuses a step in no lane", () => {
    const r = lint(plan(["        <bpmn:flowNodeRef>plan_process_close</bpmn:flowNodeRef>\n", ""]));
    expect(rulesOf(r.findings, "plan_process_close")).toContain("lanes-hold-every-node");
  });

  it("refuses a process with no lanes: every step is in no lane", () => {
    const r = lint(
      PLAN.replace(/\s*<bpmn:laneSet[\s\S]*?<\/bpmn:laneSet>/, "").replace(
        /\s*<bpmndi:BPMNDiagram[\s\S]*<\/bpmndi:BPMNDiagram>/,
        "",
      ),
    );
    expect(r.exit).toBe(3);
    expect(rulesOf(r.findings, "plan_process_close")).toContain("lanes-hold-every-node");
  });

  it("passes a lane that names a business role no C4 element has", () => {
    expect(lint(plan(['name="Owner"', 'name="Accountant"'])).exit).toBe(0);
  });

  it("refuses a named merge", () => {
    const r = lint(
      plan([
        '<bpmn:exclusiveGateway id="askJoin">',
        '<bpmn:exclusiveGateway id="askJoin" name="Graph to edit">',
      ]),
    );
    expect(rulesOf(r.findings, "askJoin")).toContain("merge-unnamed");
  });

  it("refuses an activity with two flows out and one with two flows in", () => {
    const r = lint(
      plan(
        [
          "<bpmn:outgoing>f_context_intent</bpmn:outgoing>",
          "<bpmn:outgoing>f_context_intent</bpmn:outgoing><bpmn:outgoing>f_x</bpmn:outgoing>",
        ],
        [
          "<bpmn:incoming>f_context_intent</bpmn:incoming>",
          "<bpmn:incoming>f_context_intent</bpmn:incoming><bpmn:incoming>f_x</bpmn:incoming>",
        ],
        [
          '<bpmn:sequenceFlow id="f_filed_context"',
          '<bpmn:sequenceFlow id="f_x" sourceRef="plan_process_context" targetRef="intent" />\n    <bpmn:sequenceFlow id="f_filed_context"',
        ],
      ),
    );
    expect(rulesOf(r.findings, "plan_process_context")).toContain("one-flow-out");
    expect(rulesOf(r.findings, "intent")).toContain("one-flow-in");
    // bpmnlint's fake-join is a warning in its recommended set, and an error here
    expect(rulesOf(r.findings, "intent")).toContain("fake-join");
  });

  it("refuses an end event without a name beside another end", () => {
    const r = lint(
      plan([
        '<bpmn:endEvent id="plan_process_dropped" name="Feature not planned">',
        '<bpmn:endEvent id="plan_process_dropped">',
      ]),
    );
    expect(rulesOf(r.findings, "plan_process_dropped")).toContain("end-events-named");
  });

  it("refuses a level of eleven activities, saying to move steps into a call activity", () => {
    const r = lint(
      plan(
        [
          '<bpmn:task id="intent" name="2.2 Write the intent and the feasibility">',
          '<bpmn:task id="extra" name="2.2a Read the request"><bpmn:incoming>f_extra</bpmn:incoming><bpmn:outgoing>f_extra2</bpmn:outgoing></bpmn:task>\n    <bpmn:task id="intent" name="2.2 Write the intent">',
        ],
        [
          '<bpmn:sequenceFlow id="f_filed_context"',
          '<bpmn:sequenceFlow id="f_extra" sourceRef="plan_process_filed" targetRef="extra" /><bpmn:sequenceFlow id="f_extra2" sourceRef="extra" targetRef="intent" />\n    <bpmn:sequenceFlow id="f_filed_context"',
        ],
      ),
    );
    const found = r.findings.find((f) => f.rule === "max-activities");
    expect(found?.id).toBe("plan_process");
    expect(found?.message).toContain("call activity");
  });

  it("refuses a step with no way to an end", () => {
    const r = lint(
      plan([
        '<bpmn:sequenceFlow id="f_close_dropped" sourceRef="plan_process_close" targetRef="plan_process_dropped" />',
        '<bpmn:sequenceFlow id="f_close_dropped" sourceRef="plan_process_close" targetRef="plan_process_close" />',
      ]),
    );
    expect(rulesOf(r.findings, "plan_process_close")).toContain("no-dead-end");
  });

  it("refuses a call activity that calls no process of the graph", () => {
    const r = lint(plan(['calledElement="plan_process"', 'calledElement="gone_process"']));
    expect(r.exit).toBe(3);
    expect(r.findings.filter((f) => f.rule === "called-process-exists")).toHaveLength(1);
  });

  it("refuses a step named after a command", () => {
    const r = lint(plan(['name="2.1 Gather the context"', 'name="Run `qsm-tasks close`"']));
    expect(rulesOf(r.findings, "plan_process_context")).toContain("no-code-in-name");
  });

  it("keeps bpmnlint's recommended rules: a step without a name", () => {
    const r = lint(
      plan([
        '<bpmn:task id="plan_process_context" name="2.1 Gather the context">',
        '<bpmn:task id="plan_process_context">',
      ]),
    );
    expect(r.exit).toBe(3);
    expect(rulesOf(r.findings, "plan_process_context")).toContain("label-required");
  });
});

describe("the graph of a checkout", () => {
  it("finds models/ of the checkout from a subdirectory for lint and paths", () => {
    const { repo } = repoWith("qsm-bpmn-checkout-", {
      "models/shop.bpmn": GRAPH,
      "sub/README.md": "x",
    });
    const sub = join(repo, "sub");
    for (const args of [["lint"], ["paths", "--all"]]) {
      expect(runBin(CLI, args, { cwd: sub }).exit).toBe(0);
    }
  });
});
