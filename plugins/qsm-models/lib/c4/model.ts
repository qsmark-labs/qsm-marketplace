// A C4 graph as LikeC4 reads it: the source with the tool's vocabulary, checked by LikeC4's own
// language services, mapped once into the elements and relations this plugin walks.
import { LikeC4 } from "likec4";
import { isRecord } from "../../../../lib/outcome.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";

/** The one C4 vocabulary. The tool supplies it; a source declares no specification of its own. */
const VOCABULARY = `
specification {
  element person
  element system
  element container
  element component
  relationship uses
  tag external
  tag agent
  tag shared
  tag artifact
}
`;

type Kind = "person" | "system" | "container" | "component";
const KINDS: readonly Kind[] = ["person", "system", "container", "component"];

export interface C4Element {
  readonly id: string;
  readonly kind: Kind;
  readonly title: string;
  readonly summary: string;
  readonly technology: string;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, string>>;
  readonly parent: string | null;
}

export interface C4Relation {
  readonly from: string;
  readonly to: string;
  readonly title: string;
  readonly technology: string;
}

/** An error LikeC4 found, on a line of the source counted from 1. */
interface SourceError {
  readonly line: number;
  readonly message: string;
}

export interface C4Model {
  readonly file: string;
  readonly source: string;
  readonly elements: readonly C4Element[];
  readonly relations: readonly C4Relation[];
  /** the views the source declares, LikeC4's generated `index` left out */
  readonly views: readonly string[];
}

type C4Read = { ok: true; model: C4Model } | { ok: false; errors: SourceError[] };

const parentOf = (id: string): string | null =>
  id.includes(".") ? id.slice(0, id.lastIndexOf(".")) : null;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isKind = (v: unknown): v is Kind => KINDS.some((k) => k === v);

function metadataOf(v: unknown): Record<string, string> {
  if (!isRecord(v)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? x.map(str).join(" ") : str(x)]),
  );
}

function elementOf(v: unknown, file: string): C4Element {
  if (!isRecord(v) || typeof v.id !== "string" || !isKind(v.kind)) {
    throw new QsmError(
      "failed",
      `${file}: LikeC4 gave an element this tool cannot read: ${JSON.stringify(v)}`,
    );
  }
  const tags = Array.isArray(v.tags) ? v.tags.map(str) : [];
  const summary = isRecord(v.summary) ? str(v.summary.txt) : "";
  return {
    id: v.id,
    kind: v.kind,
    title: str(v.title),
    summary,
    technology: str(v.technology),
    tags,
    metadata: metadataOf(v.metadata),
    parent: parentOf(v.id),
  };
}

function relationOf(v: unknown, file: string): C4Relation {
  const end = (x: unknown): string => (isRecord(x) ? str(x.model) : "");
  if (!isRecord(v) || end(v.source) === "" || end(v.target) === "") {
    throw new QsmError(
      "failed",
      `${file}: LikeC4 gave a relation this tool cannot read: ${JSON.stringify(v)}`,
    );
  }
  return {
    from: end(v.source),
    to: end(v.target),
    title: str(v.title),
    technology: str(v.technology),
  };
}

/** Reads a `.c4` file with the vocabulary appended after it, so every line LikeC4 names is a line
 * of the file. */
export async function readC4(file: string): Promise<C4Read> {
  const source = await Bun.file(file).text();
  const lc = await LikeC4.fromSource(`${source}\n${VOCABULARY}`, {
    printErrors: false,
    logger: false,
  });
  try {
    // LikeC4 counts lines from 0, its own CLI included; an editor counts from 1
    const errors = lc.getErrors().map((e) => ({ line: e.line + 1, message: e.message }));
    if (errors.length > 0) {
      return { ok: false, errors };
    }
    const parsed: unknown = await lc.parsedModel();
    const data = isRecord(parsed) && isRecord(parsed.$data) ? parsed.$data : {};
    const elements = isRecord(data.elements)
      ? Object.values(data.elements).map((e) => elementOf(e, file))
      : [];
    const relations = isRecord(data.relations)
      ? Object.values(data.relations).map((r) => relationOf(r, file))
      : [];
    const views = isRecord(data.views) ? Object.keys(data.views).filter((v) => v !== "index") : [];
    return { ok: true, model: { file, source, elements, relations, views } };
  } finally {
    await lc.dispose();
  }
}
