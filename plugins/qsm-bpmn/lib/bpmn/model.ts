// A BPMN graph as bpmn-moddle reads it: the few element shapes this plugin walks, and the one place
// a file becomes a parsed graph.
import { BpmnModdle } from "bpmn-moddle";
import { QsmError } from "../../../../lib/qsm-error.ts";

/** The namespace of the one link a BPMN element may carry, `c4:element`: the home of the C4
 * notation the id belongs to, an identifier never fetched, so the link names no tool. */
export const C4_NS = "https://c4model.com";

export interface ModdleElement {
  readonly $type: string;
  $parent?: ModdleElement;
  $attrs?: Record<string, string>;
  id?: string;
  name?: string;
}

export interface FlowNode extends ModdleElement {
  incoming?: SequenceFlow[];
  outgoing?: SequenceFlow[];
  calledElement?: string;
}

export interface SequenceFlow extends ModdleElement {
  sourceRef: FlowNode;
  targetRef: FlowNode;
}

export interface Lane extends ModdleElement {
  flowNodeRef?: FlowNode[];
  childLaneSet?: { lanes?: Lane[] };
}

export interface Process extends ModdleElement {
  flowElements?: ModdleElement[];
  laneSets?: { lanes?: Lane[] }[];
}

interface Participant extends ModdleElement {
  processRef?: Process;
}

interface Collaboration extends ModdleElement {
  participants?: Participant[];
}

export interface Shape extends ModdleElement {
  bpmnElement?: ModdleElement;
  label?: ModdleElement & { set(name: string, value: string): void };
  set(name: string, value: string): void;
  get(name: string): unknown;
  bounds?: { x: number; y: number; width: number; height: number };
  waypoint?: { x: number; y: number }[];
}

export interface Diagram extends ModdleElement {
  plane: ModdleElement & { bpmnElement?: ModdleElement; planeElement?: Shape[] };
}

export interface Definitions extends ModdleElement {
  rootElements: ModdleElement[];
  diagrams?: Diagram[];
}

const isFlow = (e: ModdleElement): e is SequenceFlow => e.$type === "bpmn:SequenceFlow";
export const isProcess = (e: ModdleElement): e is Process => e.$type === "bpmn:Process";
const isCollaboration = (e: ModdleElement): e is Collaboration => e.$type === "bpmn:Collaboration";

/** The flow nodes of a process: every flow element that is not a sequence flow. */
export function nodesOf(p: Process): FlowNode[] {
  return (p.flowElements ?? []).filter((e) => !isFlow(e) && e.$type !== "bpmn:DataObject");
}

export function flowsOf(p: Process): SequenceFlow[] {
  return (p.flowElements ?? []).filter(isFlow);
}

export function processesOf(defs: Definitions): Process[] {
  return defs.rootElements.filter(isProcess);
}

/** Whether an element is the process or a collaboration whose participant holds it. */
export const holds = (e: ModdleElement, processId: string): boolean =>
  e.id === processId ||
  (isCollaboration(e) && (e.participants ?? []).some((p) => p.processRef?.id === processId));

/** The diagram that draws a process: its plane is the process, or a collaboration whose
 * participant holds it. */
export function diagramOf(defs: Definitions, processId: string): Diagram | undefined {
  return (defs.diagrams ?? []).find((d) => {
    const e = d.plane.bpmnElement;
    return e !== undefined && holds(e, processId);
  });
}

/** A parsed graph: the definitions, the file it came from and the text it was read from. */
export interface Graph {
  readonly file: string;
  readonly defs: Definitions;
  readonly xml: string;
}

/** Reads a BPMN file; an XML bpmn-moddle cannot read fails naming the file and its first warning. */
export async function readGraph(file: string): Promise<Graph> {
  const xml = await Bun.file(file).text();
  return { file, defs: await parseXml(xml, file), xml };
}

export async function parseXml(xml: string, file: string): Promise<Definitions> {
  let read: { rootElement: object; warnings: { message: string }[] };
  try {
    read = await new BpmnModdle().fromXML(xml);
  } catch (e) {
    throw new QsmError("worse", `${file}: not valid BPMN 2.0 XML: ${String(e)}`, { cause: e });
  }
  const first = read.warnings[0];
  if (first !== undefined) {
    throw new QsmError("worse", `${file}: not valid BPMN 2.0: ${first.message}`);
  }
  if (!isDefinitions(read.rootElement)) {
    throw new QsmError("worse", `${file}: the root element is not bpmn:definitions`);
  }
  return read.rootElement;
}

/** A value bpmn-moddle produced: an object that names its BPMN type. */
export function isModdle(v: unknown): v is ModdleElement {
  return typeof v === "object" && v !== null && "$type" in v && typeof v.$type === "string";
}

export function isDefinitions(v: unknown): v is Definitions {
  return isModdle(v) && v.$type === "bpmn:Definitions" && "rootElements" in v;
}

export async function toXml(defs: Definitions): Promise<string> {
  const { xml } = await new BpmnModdle().toXML(defs, { format: true });
  return `${xml}\n`;
}

type Label = NonNullable<Shape["label"]>;
const isLabel = (v: unknown): v is Label =>
  isModdle(v) && "set" in v && typeof v.set === "function";

/** A label element for a shape, so its text can take a colour. */
export function newLabel(): Label {
  const label = new BpmnModdle().create("bpmndi:BPMNLabel");
  if (!isLabel(label)) {
    throw new QsmError("failed", "bpmn-moddle created no BPMNLabel", { cause: label });
  }
  return label;
}

/** The C4 id an element names in `c4:element`, whatever prefix the file binds to the
 * namespace. */
export function c4Element(e: ModdleElement, defs: Definitions): string | undefined {
  const prefixes = Object.entries(defs.$attrs ?? {})
    .filter(([k, v]) => k.startsWith("xmlns:") && v === C4_NS)
    .map(([k]) => k.slice("xmlns:".length));
  return prefixes.map((p) => e.$attrs?.[`${p}:element`]).find((v) => v !== undefined);
}

/** A property that points at an element owned elsewhere, so a walk does not enter it. */
const REFERENCE = /Ref$|^bpmnElement$|^(incoming|outgoing)$/;

/** Every element of a graph, each once, walked through the properties that own it. */
export function everyElement(defs: Definitions): ModdleElement[] {
  const out: ModdleElement[] = [];
  const seen = new Set<ModdleElement>();
  const stack: unknown[] = [defs];
  for (let v = stack.pop(); v !== undefined || stack.length > 0; v = stack.pop()) {
    if (Array.isArray(v)) {
      for (const x of v as unknown[]) {
        stack.push(x);
      }
    } else if (isModdle(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
      for (const [k, child] of Object.entries(v)) {
        if (!k.startsWith("$") && !REFERENCE.test(k)) {
          stack.push(child);
        }
      }
    }
  }
  return out;
}
