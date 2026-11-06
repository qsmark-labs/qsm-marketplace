// This plugin's BPMN rules, as a bpmnlint plugin: the Analytic sub-class, one lane per step, and
// Silver's Method and Style, so one linter reports every finding with the recommended rules.
import {
  type Definitions,
  type FlowNode,
  flowsOf,
  isDefinitions,
  isProcess,
  type Lane,
  type ModdleElement,
  nodesOf,
  type Process,
  processesOf,
} from "./model.ts";

interface Reporter {
  report(id: string, message: string): void;
}

export interface Rule {
  check(node: ModdleElement, reporter: Reporter): void;
}

// BPMN 2.0.2 clause 2.2: the Analytic conformance sub-class, Descriptive (table 2.1) plus table 2.2.
const DESCRIPTIVE = [
  "Definitions",
  "Collaboration",
  "Participant",
  "Process",
  "LaneSet",
  "Lane",
  "SequenceFlow",
  "MessageFlow",
  "ExclusiveGateway",
  "ParallelGateway",
  "Task",
  "UserTask",
  "ServiceTask",
  "SubProcess",
  "CallActivity",
  "DataObject",
  "DataObjectReference",
  "DataStoreReference",
  "DataInputAssociation",
  "DataOutputAssociation",
  "TextAnnotation",
  "Association",
  "StartEvent",
  "EndEvent",
  "MessageEventDefinition",
  "TimerEventDefinition",
  "TerminateEventDefinition",
  "Documentation",
  "Group",
  "Category",
  "CategoryValue",
  "Message",
];
const ANALYTIC = [
  "FormalExpression",
  "InclusiveGateway",
  "EventBasedGateway",
  "SendTask",
  "ReceiveTask",
  "StandardLoopCharacteristics",
  "MultiInstanceLoopCharacteristics",
  "IntermediateThrowEvent",
  "IntermediateCatchEvent",
  "BoundaryEvent",
  "LinkEventDefinition",
  "SignalEventDefinition",
  "ErrorEventDefinition",
  "EscalationEventDefinition",
  "ConditionalEventDefinition",
  "Signal",
  "Error",
  "Escalation",
];
const ALLOWED = new Set([...DESCRIPTIVE, ...ANALYTIC].map((t) => `bpmn:${t}`));
/** Diagram interchange is geometry, not process semantics. */
const GEOMETRY = ["bpmndi:", "dc:", "di:"];
const isGeometry = (type: string): boolean => GEOMETRY.some((p) => type.startsWith(p));

/** A name that quotes code: a non-empty span between two backticks. */
function quotesCode(name: string): boolean {
  const open = name.indexOf("`");
  const close = open < 0 ? -1 : name.indexOf("`", open + 1);
  return close > open + 1;
}
const SPLITS = new Set(["bpmn:ExclusiveGateway", "bpmn:InclusiveGateway"]);
const GATEWAYS = new Set([...SPLITS, "bpmn:ParallelGateway", "bpmn:EventBasedGateway"]);
const ACTIVITY =
  /^bpmn:(Task|UserTask|ServiceTask|SendTask|ReceiveTask|ScriptTask|ManualTask|BusinessRuleTask|CallActivity|SubProcess)$/;
const MAX_ACTIVITIES = 10;

const isActivity = (n: ModdleElement): boolean => ACTIVITY.test(n.$type);
const label = (n: ModdleElement): string => n.name ?? n.id ?? n.$type;
const idOf = (n: ModdleElement): string => n.id ?? n.$type;

/** A rule that looks at each process once. */
const perProcess = (check: (p: Process, reporter: Reporter) => void) => (): Rule => ({
  check(node, reporter) {
    if (isProcess(node)) {
      check(node, reporter);
    }
  },
});

/** A rule that looks at each flow node of a process. */
const perNode = (check: (n: FlowNode, reporter: Reporter) => void) => (): Rule => ({
  check(node, reporter) {
    if (isProcess(node)) {
      for (const n of nodesOf(node)) {
        check(n, reporter);
      }
    }
  },
});

function laneCounts(p: Process): Map<string, number> {
  const count = new Map<string, number>();
  const visit = (lanes: Lane[] | undefined): void => {
    for (const l of lanes ?? []) {
      for (const r of l.flowNodeRef ?? []) {
        count.set(idOf(r), (count.get(idOf(r)) ?? 0) + 1);
      }
      visit(l.childLaneSet?.lanes);
    }
  };
  for (const s of p.laneSets ?? []) {
    visit(s.lanes);
  }
  return count;
}

function definitionsOf(n: ModdleElement): Definitions | undefined {
  let at: ModdleElement | undefined = n;
  while (at !== undefined && !isDefinitions(at)) {
    at = at.$parent;
  }
  return at;
}

/** The ids of the flow nodes from which an end event can be reached, along the sequence flows. */
function reachEnd(p: Process): Set<string> {
  const into = new Map<string, FlowNode[]>();
  for (const f of flowsOf(p)) {
    into.set(idOf(f.targetRef), [...(into.get(idOf(f.targetRef)) ?? []), f.sourceRef]);
  }
  const reach = new Set<string>();
  const stack = nodesOf(p).filter((n) => n.$type === "bpmn:EndEvent");
  for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
    if (!reach.has(idOf(n))) {
      reach.add(idOf(n));
      stack.push(...(into.get(idOf(n)) ?? []));
    }
  }
  return reach;
}

export const RULES: Readonly<Record<string, () => Rule>> = {
  "analytic-only": () => ({
    check(node, reporter) {
      if (!isGeometry(node.$type) && !ALLOWED.has(node.$type)) {
        reporter.report(idOf(node), `${node.$type} is outside the BPMN Analytic sub-class`);
      }
    },
  }),
  "split-flows-labelled": perNode((n, reporter) => {
    if (!SPLITS.has(n.$type) || (n.outgoing ?? []).length < 2) {
      return;
    }
    for (const f of n.outgoing ?? []) {
      if ((f.name ?? "").trim() === "") {
        reporter.report(idOf(f), `a flow out of the split "${label(n)}" needs its answer as label`);
      }
    }
  }),
  "lanes-hold-every-node": perProcess((p, reporter) => {
    const count = laneCounts(p);
    for (const n of nodesOf(p)) {
      const k = count.get(idOf(n)) ?? 0;
      if (k !== 1) {
        reporter.report(
          idOf(n),
          k === 0 ? "is in no lane: every step has one role" : `is in ${k} lanes`,
        );
      }
    }
  }),
  "max-activities": perProcess((p, reporter) => {
    const k = nodesOf(p).filter(isActivity).length;
    if (k > MAX_ACTIVITIES) {
      reporter.report(
        idOf(p),
        `holds ${k} activities, more than ${MAX_ACTIVITIES}: move a run of steps into a call activity with its own diagram`,
      );
    }
  }),
  "one-flow-out": perNode((n, reporter) => {
    if (isActivity(n) && (n.outgoing ?? []).length > 1) {
      reporter.report(
        idOf(n),
        `"${label(n)}" has ${(n.outgoing ?? []).length} outgoing flows: a decision is a gateway`,
      );
    }
  }),
  "one-flow-in": perNode((n, reporter) => {
    if (isActivity(n) && (n.incoming ?? []).length > 1) {
      reporter.report(
        idOf(n),
        `"${label(n)}" has ${(n.incoming ?? []).length} incoming flows: a loop returns through a merge gateway`,
      );
    }
  }),
  "merge-unnamed": perNode((n, reporter) => {
    const merge =
      GATEWAYS.has(n.$type) && (n.incoming ?? []).length > 1 && (n.outgoing ?? []).length <= 1;
    if (merge && (n.name ?? "").trim() !== "") {
      reporter.report(idOf(n), `the merge "${label(n)}" carries a name: a merge has none`);
    }
  }),
  "end-events-named": perProcess((p, reporter) => {
    const ends = nodesOf(p).filter((n) => n.$type === "bpmn:EndEvent");
    if (ends.length < 2) {
      return;
    }
    for (const e of ends) {
      if ((e.name ?? "").trim() === "") {
        reporter.report(idOf(e), "one of several end events has no name: each names its end state");
      }
    }
  }),
  "split-after-call": perNode((n, reporter) => {
    const next = n.outgoing?.[0]?.targetRef;
    const defs = definitionsOf(n);
    if (n.$type !== "bpmn:CallActivity" || next === undefined || defs === undefined) {
      return;
    }
    if (!SPLITS.has(next.$type) || (next.outgoing ?? []).length < 2) {
      return;
    }
    const called = processesOf(defs).find((p) => p.id === n.calledElement);
    if (called === undefined) {
      return;
    }
    const ends = new Set(
      nodesOf(called)
        .filter((e) => e.$type === "bpmn:EndEvent")
        .map((e) => e.name ?? ""),
    );
    for (const f of next.outgoing ?? []) {
      if (!ends.has(f.name ?? "")) {
        reporter.report(
          idOf(f),
          `the answer "${f.name ?? ""}" after "${label(n)}" is no end event of ${called.id ?? ""}: ${[...ends].join(", ")}`,
        );
      }
    }
  }),
  "no-dead-end": perProcess((p, reporter) => {
    const reach = reachEnd(p);
    for (const n of nodesOf(p)) {
      if (!reach.has(idOf(n))) {
        reporter.report(idOf(n), `"${label(n)}" has no way to an end event`);
      }
    }
  }),
  "no-code-in-name": () => ({
    check(node, reporter) {
      if (quotesCode(node.name ?? "")) {
        reporter.report(
          idOf(node),
          `"${label(node)}" names code in backticks: name the business step`,
        );
      }
    },
  }),
};
