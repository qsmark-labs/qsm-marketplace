// paths: the start-to-end paths of each process, their stable ids, and the cover a spec's scenarios
// must cite. A path takes each flow at most twice, so each loop goes round at most once; its id is
// a hash of the flow ids it takes, so a re-layout keeps it and a changed path changes it.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fail, ok, type Outcome } from "../../../lib/outcome.ts";
import { QsmError } from "../../../lib/qsm-error.ts";
import {
  type FlowNode,
  flowsOf,
  type Graph,
  nodesOf,
  type Process,
  processesOf,
  readGraph,
  type SequenceFlow,
} from "./bpmn/model.ts";

const LIMIT = 2;

interface Path {
  readonly id: string;
  /** what QA observes: the split answers in order, then the end */
  readonly signature: string;
  readonly flows: readonly string[];
}

interface Walked {
  readonly trail: SequenceFlow[];
  readonly end: FlowNode;
}

export interface ProcessPaths {
  readonly process: string;
  readonly total: number;
  readonly flows: number;
  readonly paths: readonly Path[];
  readonly uncovered: readonly string[];
  /** steps with no way out that are no end event */
  readonly deadEnds: readonly string[];
}

const pathId = (trail: readonly SequenceFlow[]): string =>
  `p-${createHash("sha256")
    .update(trail.map((f) => f.id ?? "").join(" "))
    .digest("hex")
    .slice(0, 6)}`;

function walk(p: Process): { all: Walked[]; dead: Set<string> } {
  const all: Walked[] = [];
  const dead = new Set<string>();
  const out = new Map<string, SequenceFlow[]>();
  for (const f of flowsOf(p)) {
    out.set(f.sourceRef.id ?? "", [...(out.get(f.sourceRef.id ?? "") ?? []), f]);
  }
  const step = (
    n: FlowNode,
    trail: SequenceFlow[],
    taken: ReadonlyMap<SequenceFlow, number>,
  ): void => {
    if (n.$type === "bpmn:EndEvent") {
      all.push({ trail, end: n });
      return;
    }
    const next = out.get(n.id ?? "") ?? [];
    if (next.length === 0) {
      dead.add(n.name ?? n.id ?? "");
      return;
    }
    for (const f of next) {
      const k = taken.get(f) ?? 0;
      if (k < LIMIT) {
        step(f.targetRef, [...trail, f], new Map([...taken, [f, k + 1]]));
      }
    }
  };
  for (const s of nodesOf(p).filter((e) => e.$type === "bpmn:StartEvent")) {
    step(s, [], new Map());
  }
  return { all, dead };
}

function toPath(w: Walked): Path {
  const answers = w.trail
    .filter((f) => (f.name ?? "") !== "")
    .map((f) => `${f.sourceRef.name ?? f.sourceRef.id ?? ""} ${f.name ?? ""}`);
  const end = w.end.name ?? w.end.id ?? "";
  return {
    id: pathId(w.trail),
    signature: [...answers, `-> ${end}`].join("; "),
    flows: w.trail.map((f) => f.id ?? ""),
  };
}

/** The cover: until every flow is taken, the path that adds the most flows not yet taken, a tie to
 * the fewer flows, then the lowest id. */
function cover(
  paths: readonly Path[],
  flows: readonly string[],
): { chosen: Path[]; left: Set<string> } {
  const left = new Set(flows);
  const chosen: Path[] = [];
  const gain = (p: Path): number => new Set(p.flows.filter((f) => left.has(f))).size;
  // most new flows first, then the fewer flows, then the lowest id, so the cover is reproducible
  const before = (a: Path, b: Path): number =>
    gain(b) - gain(a) || a.flows.length - b.flows.length || a.id.localeCompare(b.id);
  const bestOf = (): Path | undefined => {
    let best: Path | undefined;
    for (const p of paths) {
      if (best === undefined || before(p, best) < 0) {
        best = p;
      }
    }
    return best;
  };
  for (let best = bestOf(); best !== undefined && gain(best) > 0; best = bestOf()) {
    chosen.push(best);
    for (const f of best.flows) {
      left.delete(f);
    }
  }
  return { chosen, left };
}

/** The walk of a process: its paths and its dead ends. */
interface Walks {
  readonly paths: readonly Path[];
  readonly dead: ReadonlySet<string>;
}

function walksOf(p: Process): Walks {
  const { all, dead } = walk(p);
  return { paths: all.map(toPath), dead };
}

function processPaths(p: Process, { paths, dead }: Walks, all: boolean): ProcessPaths {
  const flows = flowsOf(p).map((f) => f.id ?? "");
  const { chosen, left } = cover(paths, flows);
  return {
    process: p.id ?? "",
    total: paths.length,
    flows: flows.length,
    paths: all ? paths : chosen,
    uncovered: [...left],
    deadEnds: [...dead],
  };
}

/** A process by its id, or by the id without its `_process` suffix. */
function pick(graph: Graph, id: string | undefined): Process[] {
  const ps = processesOf(graph.defs);
  if (id === undefined) {
    return ps;
  }
  const found = ps.filter((p) => p.id === id || p.id === `${id}_process`);
  if (found.length === 0) {
    throw new QsmError(
      "usage",
      `${graph.file} has no process ${id}: ${ps.map((p) => p.id ?? "").join(", ")}`,
    );
  }
  return found;
}

/** Every path id a spec cites, with the files that cite it. */
function citations(dir: string): Map<string, Set<string>> {
  const cited = new Map<string, Set<string>>();
  const visit = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true }).toSorted((a, b) =>
      a.name < b.name ? -1 : Number(a.name > b.name),
    )) {
      const at = join(d, e.name);
      if (e.isDirectory()) {
        visit(at);
      } else if (e.name.endsWith(".md")) {
        for (const m of readFileSync(at, "utf8").matchAll(/\bp-[0-9a-f]{6}\b/g)) {
          cited.set(m[0], (cited.get(m[0]) ?? new Set<string>()).add(at));
        }
      }
    }
  };
  visit(dir);
  return cited;
}

/** What a spec directory says about the paths: the shown ones it never cites, and the ids it cites
 * that are no path of the graph (`known` holds every path id of every process). */
function specFindings(
  graph: Graph,
  shown: readonly ProcessPaths[],
  known: ReadonlySet<string>,
  dir: string,
): string[] {
  const cited = citations(dir);
  const uncited = shown.flatMap((pp) =>
    pp.paths
      .filter((x) => !cited.has(x.id))
      .map((x) => `${x.id} of ${pp.process} (${x.signature}) is cited by no scenario under ${dir}`),
  );
  const unknown = [...cited]
    .filter(([id]) => !known.has(id))
    .map(([id, files]) => `${id}, cited in ${[...files].join(", ")}, is no path of ${graph.file}`);
  return [...uncited, ...unknown];
}

export interface PathsCall {
  readonly file: string;
  readonly process: string | undefined;
  readonly all: boolean;
  readonly specs: string | undefined;
}

const render = (pp: ProcessPaths): string =>
  [
    `# ${pp.process}: ${pp.total} paths, ${pp.paths.length} shown, ${pp.flows} flows`,
    ...pp.paths.map((x) => `${x.id}  ${x.signature}`),
    ...(pp.uncovered.length > 0 ? [`UNCOVERED ${pp.uncovered.join(" ")}`] : []),
  ].join("\n");

export async function pathsOf(
  call: PathsCall,
): Promise<Outcome<{ processes: ProcessPaths[]; findings: string[] }>> {
  const graph = await readGraph(call.file);
  // each process is walked once, whether its paths are shown or only known to a spec
  const walks = new Map<string, Walks>();
  const walked = (p: Process): Walks => {
    const w = walks.get(p.id ?? "") ?? walksOf(p);
    walks.set(p.id ?? "", w);
    return w;
  };
  const processes = pick(graph, call.process).map((p) => processPaths(p, walked(p), call.all));
  const dead = processes.flatMap((pp) =>
    pp.deadEnds.map(
      (d) => `${pp.process}: "${d}" has no way out and is no end event, so no path through it ends`,
    ),
  );
  const findings = [
    ...dead,
    ...(call.specs === undefined
      ? []
      : specFindings(
          graph,
          processes,
          new Set(processesOf(graph.defs).flatMap((p) => walked(p).paths.map((x) => x.id))),
          call.specs,
        )),
  ];
  const text = processes.map(render).join("\n");
  if (findings.length > 0) {
    return fail("worse", `${text}\n${findings.join("\n")}`, { processes, findings });
  }
  return ok({ processes, findings }, text);
}
