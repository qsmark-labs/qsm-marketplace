// qsm-models lint through its real surface: a graph on disk in, one envelope out. Each BPMN fixture
// is the real planning process with one change that breaks one rule.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { envelopeOf, runBin } from "../../../lib/fixtures/cli.ts";
import { isRecord } from "../../../lib/outcome.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { CLI, PLAN } from "./fixtures/plan.ts";

interface Found {
  id: string;
  rule: string;
  message: string;
}

const isFound = (v: unknown): v is Found =>
  isRecord(v) &&
  typeof v.id === "string" &&
  typeof v.rule === "string" &&
  typeof v.message === "string";

function findingsOf(data: unknown): Found[] {
  if (!isRecord(data) || !Array.isArray(data.findings)) {
    throw new Error(`no findings in ${JSON.stringify(data)}`);
  }
  return data.findings.filter(isFound);
}

/** Lints `text` as a file named `name` and returns the exit and the findings. */
function lint(text: string, name = "plan.bpmn"): { exit: number; findings: Found[] } {
  const dir = sandboxDir("qsm-models-lint-");
  writeIn(dir, name, text);
  const run = runBin(CLI, ["lint", join(dir, name), "--json"]);
  return { exit: run.exit, findings: findingsOf(envelopeOf(run.stdout).data) };
}

/** The planning process with `from` replaced by `to`, which must be there. */
function plan(...edits: [string, string][]): string {
  return edits.reduce((xml, [from, to]) => {
    expect(xml).toContain(from);
    return xml.replace(from, to);
  }, PLAN);
}

const rulesOf = (fs: Found[], id: string): string[] =>
  fs.filter((f) => f.id === id).map((f) => f.rule);

describe("lint on BPMN", () => {
  it("passes the real planning process", () => {
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
          '<bpmn:exclusiveGateway id="verdict" name="Plan approved?">',
          '<bpmn:complexGateway id="verdict" name="Plan approved?">',
        ],
        [
          '</bpmn:exclusiveGateway>\n    <bpmn:serviceTask id="commit"',
          '</bpmn:complexGateway>\n    <bpmn:serviceTask id="commit"',
        ],
      ),
    );
    expect(r.exit).toBe(3);
    expect(rulesOf(r.findings, "verdict")).toContain("analytic-only");
  });

  it("refuses a step in no lane", () => {
    const r = lint(plan(["        <bpmn:flowNodeRef>close</bpmn:flowNodeRef>\n", ""]));
    expect(rulesOf(r.findings, "close")).toContain("lanes-hold-every-node");
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
          '<bpmn:sequenceFlow id="f_x" sourceRef="context" targetRef="intent" />\n    <bpmn:sequenceFlow id="f_filed_context"',
        ],
      ),
    );
    expect(rulesOf(r.findings, "context")).toContain("one-flow-out");
    expect(rulesOf(r.findings, "intent")).toContain("one-flow-in");
    // bpmnlint's fake-join is a warning in its recommended set, and an error here
    expect(rulesOf(r.findings, "intent")).toContain("fake-join");
  });

  it("refuses an end event without a name beside another end", () => {
    const r = lint(
      plan([
        '<bpmn:endEvent id="dropped" name="Feature not planned">',
        '<bpmn:endEvent id="dropped">',
      ]),
    );
    expect(rulesOf(r.findings, "dropped")).toContain("end-events-named");
  });

  it("refuses a level of eleven activities, saying to move steps into a call activity", () => {
    const r = lint(
      plan(
        [
          '<bpmn:task id="intent" name="2.2 Write the intent">',
          '<bpmn:task id="extra" name="2.2a Read the request"><bpmn:incoming>f_extra</bpmn:incoming><bpmn:outgoing>f_extra2</bpmn:outgoing></bpmn:task>\n    <bpmn:task id="intent" name="2.2 Write the intent">',
        ],
        [
          '<bpmn:sequenceFlow id="f_filed_context"',
          '<bpmn:sequenceFlow id="f_extra" sourceRef="filed" targetRef="extra" /><bpmn:sequenceFlow id="f_extra2" sourceRef="extra" targetRef="intent" />\n    <bpmn:sequenceFlow id="f_filed_context"',
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
        '<bpmn:sequenceFlow id="f_close_dropped" sourceRef="close" targetRef="dropped" />',
        '<bpmn:sequenceFlow id="f_close_dropped" sourceRef="close" targetRef="close" />',
      ]),
    );
    expect(rulesOf(r.findings, "close")).toContain("no-dead-end");
  });

  it("refuses a step named after a command", () => {
    const r = lint(plan(['name="2.1 Gather the context"', 'name="Run `qsm-tasks close`"']));
    expect(rulesOf(r.findings, "context")).toContain("no-code-in-name");
  });

  it("keeps bpmnlint's recommended rules: a step without a name", () => {
    const r = lint(
      plan(['<bpmn:task id="context" name="2.1 Gather the context">', '<bpmn:task id="context">']),
    );
    expect(r.exit).toBe(3);
    expect(rulesOf(r.findings, "context")).toContain("label-required");
  });
});

const C4 = readFileSync(
  resolve(import.meta.dir, "../../../openspec/changes/feature-flow/models/marketplace.c4"),
  "utf8",
);

/** The marketplace's C4 source with `from` replaced by `to`, which must be there. */
function c4(from: string, to: string): string {
  expect(C4).toContain(from);
  return C4.replace(from, to);
}

describe("lint on C4", () => {
  it("passes the marketplace's source, a container without components included", () => {
    expect(lint(C4, "marketplace.c4")).toEqual({ exit: 0, findings: [] });
  });

  it("gives the message and line of likec4 validate for a relation to a missing element", () => {
    const r = lint(c4("  owner -> agent 'plans", "  owner -> nobody 'plans"), "marketplace.c4");
    expect(r.exit).toBe(3);
    const line = C4.split("\n").findIndex((l) => l.startsWith("  owner -> agent 'plans")) + 1;
    expect(r.findings.map(({ id, rule, message }) => ({ id, rule, message }))).toContainEqual({
      id: `line ${line}`,
      rule: "likec4-validate",
      message: "Could not resolve reference to Referenceable named 'nobody'.",
    });
  });

  it("refuses a container inside a container, which LikeC4 accepts", () => {
    const r = lint(
      c4(
        "    cockpit = container 'qsm-cockpit'",
        "    nested = container 'Nested' 'x' {\n      metadata { path 'x' }\n      inner = container 'Inner' 'y' { metadata { path 'y' } }\n    }\n    cockpit = container 'qsm-cockpit'",
      ),
      "marketplace.c4",
    );
    const found = r.findings.find((f) => f.id === "mp.nested.inner");
    expect(found?.rule).toBe("level");
    expect(found?.message).toContain("a container sits in a system");
  });

  it("refuses two agents in one colour, naming both and the colour", () => {
    const r = lint(
      c4("metadata { colour 'green' }", "metadata { colour 'orange' }"),
      "marketplace.c4",
    );
    expect(r.findings.map(({ id, rule, message }) => ({ id, rule, message }))).toContainEqual({
      id: "reviewer, qa",
      rule: "actor-colour",
      message: "reviewer and qa are both orange: each actor has its own colour",
    });
  });

  it("refuses a source with its own specification or views", () => {
    const r = lint(
      `${C4}\nspecification {\n  element box\n}\nviews {\n  view mine {\n    include *\n  }\n}\n`,
      "marketplace.c4",
    );
    expect(r.findings.map((f) => f.rule).toSorted()).toEqual(["own-views", "own-vocabulary"]);
  });

  it("refuses a relation without technology, two equal titles and a container without its path", () => {
    const r = lint(
      c4(
        "  owner -> agent 'plans, splits and reviews with' { technology 'terminal' }",
        "  owner -> agent 'plans, splits and reviews with'",
      )
        .replace("ccr = container 'qsm-ccr'", "ccr = container 'qsm-cockpit'")
        .replace(
          "metadata { group 'Harness' path 'plugins/qsm-opencode' }",
          "metadata { group 'Harness' }",
        ),
      "marketplace.c4",
    );
    expect(r.findings.map((f) => `${f.id} ${f.rule}`).toSorted()).toEqual([
      "mp.cockpit, mp.ccr unique-title",
      "mp.opencode container-path",
      "owner -> agent relation-technology",
    ]);
  });
});
