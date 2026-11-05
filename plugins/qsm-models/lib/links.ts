// The links a graph may carry, each optional and each checked where present: a BPMN element to a
// C4 element (`qsm:c4`), a node to the decision behind it (`qsm:decision`, C4 `decision`), and a
// call into a process of the same graph. A link into another project needs the qsm-docs store.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { QsmError } from "../../../lib/qsm-error.ts";
import {
  everyElement,
  type Graph,
  type ModdleElement,
  nodesOf,
  processesOf,
  qsmAttr,
} from "./bpmn/model.ts";
import type { C4Model } from "./c4/model.ts";

const storeNotReached = (): QsmError =>
  new QsmError(
    "missing",
    "a link into another project needs qsm-docs, which this build does not reach",
    {
      next: "install qsm-docs, or call a process of this graph",
    },
  );

/** Why a decision link does not resolve, or nothing when it does. */
function decisionProblem(
  root: string,
  link: string,
  commitExists: (sha: string) => boolean,
): string | undefined {
  if (link.startsWith("commit:")) {
    const sha = link.slice("commit:".length);
    return /^[0-9a-f]{7,40}$/.test(sha) && commitExists(sha)
      ? undefined
      : `commit ${sha} is not in this repository`;
  }
  const m = /^design:([^#]+)#(\d+)$/.exec(link);
  if (m === null) {
    return `"${link}" is neither design:<repo path>#<n> nor commit:<sha>`;
  }
  const [, path = "", n = ""] = m;
  const file = join(root, path);
  if (!existsSync(file)) {
    return `${path} does not exist`;
  }
  const numbered = readFileSync(file, "utf8")
    .split("\n")
    .some((l) => l.trimStart().startsWith(`${n}. `));
  return numbered ? undefined : `${path} has no numbered item ${n}`;
}

export interface LinkContext {
  readonly root: string;
  readonly commitExists: (sha: string) => boolean;
}

/** The link problems of one BPMN element. */
function elementProblems(
  e: ModdleElement,
  graph: Graph,
  c4: C4Model | undefined,
  ctx: LinkContext,
): string[] {
  const out: string[] = [];
  const c4Link = qsmAttr(e, "c4", graph.defs);
  if (c4Link !== undefined && c4?.elements.some((x) => x.id === c4Link) !== true) {
    out.push(
      c4 === undefined
        ? `qsm:c4="${c4Link}", and the project has no C4 graph`
        : `qsm:c4="${c4Link}" names no element of ${c4.file}`,
    );
  }
  const decision = qsmAttr(e, "decision", graph.defs);
  const why =
    decision === undefined ? undefined : decisionProblem(ctx.root, decision, ctx.commitExists);
  if (why !== undefined) {
    out.push(`qsm:decision="${decision ?? ""}": ${why}`);
  }
  return out.map((what) => `${graph.file}: ${e.id ?? "(element)"}: ${what}`);
}

/** Each call activity that calls a process this graph lacks; a call into another project throws. */
function callProblems(graph: Graph): string[] {
  const processes = new Set(processesOf(graph.defs).map((p) => p.id));
  const calls = processesOf(graph.defs)
    .flatMap(nodesOf)
    .filter((n) => n.$type === "bpmn:CallActivity");
  if (calls.some((n) => (n.calledElement ?? "").includes(":"))) {
    throw storeNotReached();
  }
  return calls
    .filter((n) => !processes.has(n.calledElement))
    .map(
      (n) =>
        `${graph.file}: ${n.id ?? "(call)"}: calls ${n.calledElement ?? "no process"}, which is no process of this graph`,
    );
}

/** Every BPMN link that does not resolve, each naming the element, the link and why. */
export function bpmnLinkFindings(
  graph: Graph,
  c4: C4Model | undefined,
  ctx: LinkContext,
): string[] {
  return [
    ...everyElement(graph.defs).flatMap((e) => elementProblems(e, graph, c4, ctx)),
    ...callProblems(graph),
  ];
}

/** Every C4 link that does not resolve. */
export function c4LinkFindings(m: C4Model, ctx: LinkContext): string[] {
  const out: string[] = [];
  for (const e of m.elements) {
    if (e.metadata.project !== undefined) {
      throw storeNotReached();
    }
    const decision = e.metadata.decision;
    const why =
      decision === undefined ? undefined : decisionProblem(ctx.root, decision, ctx.commitExists);
    if (why !== undefined) {
      out.push(`${m.file}: ${e.id}: decision "${decision ?? ""}": ${why}`);
    }
  }
  return out;
}
