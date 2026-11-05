// lint for C4: LikeC4's own check first, then the vocabulary, the levels and the colours of the
// actors, the rules a LikeC4 source may break and still validate.
import type { Finding } from "../bpmn/lint.ts";
import { type C4Element, type C4Model, readC4 } from "./model.ts";
import { PALETTE } from "./style.ts";

const METADATA = new Set([
  "colour",
  "group",
  "path",
  "project",
  "verified",
  "decision",
  "layer",
  "order",
]);
/** Where each kind may sit: its parent's kind, or the top. */
const PARENT: Readonly<Record<C4Element["kind"], C4Element["kind"] | null>> = {
  person: null,
  system: null,
  container: "system",
  component: "container",
};
const NEST: Readonly<Record<C4Element["kind"], string>> = {
  person: "a person sits at the top, in no element",
  system: "a system sits at the top, in no element",
  container: "a container sits in a system",
  component: "a component sits in a container",
};

export const isActor = (e: C4Element): boolean => e.kind === "person" || e.tags.includes("agent");

export function isExternal(
  e: C4Element | undefined,
  byId: ReadonlyMap<string, C4Element>,
): boolean {
  for (let at = e; at !== undefined; at = at.parent === null ? undefined : byId.get(at.parent)) {
    if (at.tags.includes("external")) {
      return true;
    }
  }
  return false;
}

/** A finding before it names its file. */
type Problem = Omit<Finding, "file">;
type ById = ReadonlyMap<string, C4Element>;

function sourceProblems(m: C4Model): Problem[] {
  const own = /^\s*specification\s*\{/m.test(m.source)
    ? [
        {
          id: "specification",
          rule: "own-vocabulary",
          message:
            "the source declares its own specification: the tool supplies the kinds and tags",
        },
      ]
    : [];
  const views = m.views.map((v) => ({
    id: v,
    rule: "own-views",
    message: "the source declares a view: the tool generates one view per level",
  }));
  return [...own, ...views];
}

function levelProblems(e: C4Element, byId: ById): Problem[] {
  const parentKind = e.parent === null ? null : (byId.get(e.parent)?.kind ?? null);
  if (parentKind === PARENT[e.kind]) {
    return [];
  }
  const where = e.parent === null ? "the top" : `the ${parentKind ?? "?"} ${e.parent}`;
  return [{ id: e.id, rule: "level", message: `${NEST[e.kind]}, not in ${where}` }];
}

function metadataProblems(e: C4Element): Problem[] {
  return Object.keys(e.metadata)
    .filter((k) => !METADATA.has(k))
    .map((k) => ({
      id: e.id,
      rule: "metadata",
      message: `metadata ${k} is none of ${[...METADATA].join(", ")}`,
    }));
}

function pathProblems(e: C4Element, byId: ById): Problem[] {
  const internal = e.kind === "container" && !isExternal(e, byId);
  return internal && (e.metadata.path ?? "") === ""
    ? [
        {
          id: e.id,
          rule: "container-path",
          message: "an internal container names its code in metadata path",
        },
      ]
    : [];
}

function titleProblems(m: C4Model): Problem[] {
  const titles = Map.groupBy(m.elements, (e) => e.title);
  return [...titles]
    .filter(([, es]) => es.length > 1)
    .map(([title, es]) => ({
      id: es.map((e) => e.id).join(", "),
      rule: "unique-title",
      message: `${es.length} elements are titled "${title}"`,
    }));
}

function colourProblems(m: C4Model): Problem[] {
  const out: Problem[] = [];
  const owner = new Map<string, string>();
  for (const e of m.elements.filter((x) => isActor(x) && x.parent === null)) {
    const colour = e.metadata.colour ?? "";
    const other = owner.get(colour);
    if (PALETTE[colour] === undefined) {
      out.push({
        id: e.id,
        rule: "actor-colour",
        message: `an actor carries a colour of the palette (${Object.keys(PALETTE).join(", ")})`,
      });
    } else if (other !== undefined) {
      out.push({
        id: `${other}, ${e.id}`,
        rule: "actor-colour",
        message: `${other} and ${e.id} are both ${colour}: each actor has its own colour`,
      });
    }
    owner.set(colour, e.id);
  }
  return out;
}

function relationProblems(m: C4Model): Problem[] {
  return m.relations.flatMap((r) => [
    ...(r.title === ""
      ? [
          {
            id: `${r.from} -> ${r.to}`,
            rule: "relation-title",
            message: "a relation says what it does",
          },
        ]
      : []),
    ...(r.technology === ""
      ? [
          {
            id: `${r.from} -> ${r.to}`,
            rule: "relation-technology",
            message: "a relation names its technology",
          },
        ]
      : []),
  ]);
}

/** Every rule over a model LikeC4 accepted. */
function lintModel(m: C4Model): Finding[] {
  const byId = new Map(m.elements.map((e) => [e.id, e]));
  const perElement = m.elements.flatMap((e) => [
    ...levelProblems(e, byId),
    ...metadataProblems(e),
    ...pathProblems(e, byId),
  ]);
  return [
    ...sourceProblems(m),
    ...perElement,
    ...titleProblems(m),
    ...colourProblems(m),
    ...relationProblems(m),
  ].map((p) => ({ file: m.file, ...p }));
}

export async function lintC4(file: string): Promise<Finding[]> {
  const read = await readC4(file);
  if (!read.ok) {
    return read.errors.map((e) => ({
      file,
      id: `line ${e.line}`,
      rule: "likec4-validate",
      message: e.message,
    }));
  }
  return lintModel(read.model);
}
