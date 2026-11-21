// The one link a BPMN graph may carry outside itself, a C4 id in `c4:element`, resolved through
// qsm-c4's CLI and never by reading a `.c4` file, and only when the graph carries one: a graph
// without an id needs no other plugin.
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import type { Finding } from "../../../lib/model-graph.ts";
import { binPath, isRecord, OUTCOME_CODES, type OutcomeCode } from "../../../lib/outcome.ts";
import { QsmError } from "../../../lib/qsm-error.ts";
import {
  C4_NS,
  c4Element,
  type Definitions,
  everyElement,
  type Graph,
  type ModdleElement,
  type Shape,
} from "./bpmn/model.ts";

/** What qsm-bpmn reads of an element qsm-c4 lists: an actor's colour, as hex. */
interface Listed {
  readonly colour: string | undefined;
}

const isFailure = (v: unknown): v is Exclude<OutcomeCode, "ok"> =>
  v !== "ok" && OUTCOME_CODES.some((c) => c === v);

/** The envelope `qsm-c4 elements --json` printed; a failure it reports is thrown with its code. */
function envelopeOf(stdout: string, stderr: string): Record<string, unknown> {
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout);
  } catch (e) {
    throw new QsmError("failed", `qsm-c4 elements printed no envelope: ${stderr.trim()}`, {
      cause: e,
    });
  }
  if (!isRecord(envelope)) {
    throw new QsmError("failed", "qsm-c4 elements printed no envelope", { cause: envelope });
  }
  if (isFailure(envelope.code)) {
    throw new QsmError(envelope.code, `qsm-c4 elements: ${String(envelope.message)}`);
  }
  return envelope;
}

/** One listed element: its id and, for an actor, its colour's hex. */
function listedOf(e: unknown): [string, Listed][] {
  if (!isRecord(e) || typeof e.id !== "string") {
    return [];
  }
  const hex = isRecord(e.colour) && typeof e.colour.hex === "string" ? e.colour.hex : undefined;
  return [[e.id, { colour: hex }]];
}

/** The elements of the C4 graph beside `file`, by id, as `qsm-c4 elements --json` lists them.
 * Without qsm-c4 on PATH the graph cannot be read, and that is `missing`, with no fallback. */
export function c4Elements(file: string): Map<string, Listed> {
  const qsmC4 = binPath("qsm-c4");
  if (qsmC4 === null) {
    throw new QsmError("missing", `${file} carries a C4 id, and qsm-c4 is not on PATH`, {
      next: "install qsm-c4: claude plugin install qsm-c4@qsm-marketplace",
    });
  }
  const run = spawnSync(qsmC4, ["elements", dirname(file), "--json"], { encoding: "utf8" });
  const envelope = envelopeOf(run.stdout, run.stderr);
  const list = isRecord(envelope.data) ? envelope.data.elements : undefined;
  if (!Array.isArray(list)) {
    throw new QsmError("failed", "qsm-c4 elements listed no elements", { cause: envelope });
  }
  return new Map(list.flatMap(listedOf));
}

/** A `c4` prefix bound to another namespace: every c4:element of the file goes unread. */
function prefixProblems(file: string, defs: Definitions): Finding[] {
  const bound = defs.$attrs?.["xmlns:c4"];
  if (bound === undefined || bound === C4_NS) {
    return [];
  }
  const message = `the prefix c4 is bound to ${bound}, not ${C4_NS}, so no c4:element is read`;
  return [{ file, id: defs.id ?? "(definitions)", rule: "c4-namespace", message }];
}

/** What is wrong with one link: an id qsm-c4 does not list, or a linked lane drawn in another
 * colour than its actor's. */
function linkProblem(
  e: ModdleElement,
  id: string,
  listed: ReadonlyMap<string, Listed>,
  strokeOf: ReadonlyMap<string, unknown>,
): Omit<Finding, "file"> | undefined {
  const at = e.id ?? e.$type;
  const c4 = listed.get(id);
  if (c4 === undefined) {
    return {
      id: at,
      rule: "c4-element",
      message: `c4:element="${id}" names no element of the C4 graph`,
    };
  }
  const stroke = strokeOf.get(at);
  const drawn = e.$type === "bpmn:Lane" && typeof stroke === "string" ? stroke : undefined;
  if (c4.colour === undefined || drawn === undefined || drawn === c4.colour) {
    return undefined;
  }
  return {
    id: at,
    rule: "lane-colour",
    message: `the lane links to ${id}, whose colour is ${c4.colour}, and is drawn in ${drawn}`,
  };
}

const isShape = (e: ModdleElement): e is Shape => e.$type === "bpmndi:BPMNShape";

/** The findings of the C4 ids a graph carries; a graph without one starts nothing. */
export function c4Findings(graph: Graph): Finding[] {
  const { file, defs } = graph;
  const all = everyElement(defs);
  const linked = all.flatMap((e) => {
    const id = c4Element(e, defs);
    return id === undefined ? [] : [{ e, id }];
  });
  if (linked.length === 0) {
    return prefixProblems(file, defs);
  }
  const listed = c4Elements(file);
  const strokeOf = new Map(
    all.filter(isShape).map((s) => [s.bpmnElement?.id ?? "", s.get("bioc:stroke")]),
  );
  const problems = linked.flatMap(({ e, id }) => linkProblem(e, id, listed, strokeOf) ?? []);
  return [...prefixProblems(file, defs), ...problems.map((p) => ({ file, ...p }))];
}
