// lint for BPMN: bpmnlint's recommended rules, every warning raised to an error, and this plugin's
// rules, through bpmnlint's static resolver, because its own resolver loads rules by `require` and
// cannot find them inside a compiled binary (design Verify 2).
import Linter from "bpmnlint/lib/linter";
import StaticResolver from "bpmnlint/lib/resolver/static-resolver";
import recommended from "bpmnlint/config/recommended";
import adHocSubProcess from "bpmnlint/rules/ad-hoc-sub-process";
import conditionalFlows from "bpmnlint/rules/conditional-flows";
import endEventRequired from "bpmnlint/rules/end-event-required";
import eventBasedGateway from "bpmnlint/rules/event-based-gateway";
import eventSubProcessTypedStartEvent from "bpmnlint/rules/event-sub-process-typed-start-event";
import fakeJoin from "bpmnlint/rules/fake-join";
import global from "bpmnlint/rules/global";
import labelRequired from "bpmnlint/rules/label-required";
import linkEvent from "bpmnlint/rules/link-event";
import noBpmndi from "bpmnlint/rules/no-bpmndi";
import noComplexGateway from "bpmnlint/rules/no-complex-gateway";
import noDisconnected from "bpmnlint/rules/no-disconnected";
import noDuplicateSequenceFlows from "bpmnlint/rules/no-duplicate-sequence-flows";
import noGatewayJoinFork from "bpmnlint/rules/no-gateway-join-fork";
import noImplicitEnd from "bpmnlint/rules/no-implicit-end";
import noImplicitSplit from "bpmnlint/rules/no-implicit-split";
import noImplicitStart from "bpmnlint/rules/no-implicit-start";
import noInclusiveGateway from "bpmnlint/rules/no-inclusive-gateway";
import noOverlappingElements from "bpmnlint/rules/no-overlapping-elements";
import singleBlankStartEvent from "bpmnlint/rules/single-blank-start-event";
import singleEventDefinition from "bpmnlint/rules/single-event-definition";
import startEventRequired from "bpmnlint/rules/start-event-required";
import subProcessBlankStartEvent from "bpmnlint/rules/sub-process-blank-start-event";
import superfluousGateway from "bpmnlint/rules/superfluous-gateway";
import superfluousLabel from "bpmnlint/rules/superfluous-label";
import superfluousTermination from "bpmnlint/rules/superfluous-termination";
import type { Finding } from "../../../../lib/model-graph.ts";
import type { Definitions } from "./model.ts";
import { RULES } from "./rules.ts";

const RECOMMENDED: Readonly<Record<string, unknown>> = {
  "ad-hoc-sub-process": adHocSubProcess,
  "conditional-flows": conditionalFlows,
  "end-event-required": endEventRequired,
  "event-based-gateway": eventBasedGateway,
  "event-sub-process-typed-start-event": eventSubProcessTypedStartEvent,
  "fake-join": fakeJoin,
  global,
  "label-required": labelRequired,
  "link-event": linkEvent,
  "no-bpmndi": noBpmndi,
  "no-complex-gateway": noComplexGateway,
  "no-disconnected": noDisconnected,
  "no-duplicate-sequence-flows": noDuplicateSequenceFlows,
  "no-gateway-join-fork": noGatewayJoinFork,
  "no-implicit-end": noImplicitEnd,
  "no-implicit-split": noImplicitSplit,
  "no-implicit-start": noImplicitStart,
  "no-inclusive-gateway": noInclusiveGateway,
  "no-overlapping-elements": noOverlappingElements,
  "single-blank-start-event": singleBlankStartEvent,
  "single-event-definition": singleEventDefinition,
  "start-event-required": startEventRequired,
  "sub-process-blank-start-event": subProcessBlankStartEvent,
  "superfluous-gateway": superfluousGateway,
  "superfluous-label": superfluousLabel,
  "superfluous-termination": superfluousTermination,
};

const PLUGIN = "bpmnlint-plugin-qsm";

function resolver(): object {
  const cache: Record<string, unknown> = {};
  for (const [name, rule] of Object.entries(RECOMMENDED)) {
    cache[`rule:bpmnlint/${name}`] = rule;
  }
  for (const [name, rule] of Object.entries(RULES)) {
    cache[`rule:${PLUGIN}/${name}`] = rule;
  }
  return new StaticResolver(cache);
}

/** Every recommended rule, a warning raised to an error, then ours. */
function config(): { rules: Record<string, string> } {
  const rules: Record<string, string> = {};
  for (const name of Object.keys(recommended.rules)) {
    rules[name] = "error";
  }
  for (const name of Object.keys(RULES)) {
    rules[`qsm/${name}`] = "error";
  }
  return { rules };
}

/** The findings of one graph, sorted by element and rule so a run reads the same every time. */
export async function lintBpmn(file: string, defs: Definitions): Promise<Finding[]> {
  const reports = await new Linter({ config: config(), resolver: resolver() }).lint(defs);
  const findings = Object.entries(reports).flatMap(([rule, list]) =>
    list.map((r) => ({
      file,
      id: r.id ?? "(graph)",
      rule: rule.replace(/^qsm\//, ""),
      message: r.message,
    })),
  );
  return findings.toSorted((a, b) => a.id.localeCompare(b.id) || a.rule.localeCompare(b.rule));
}
