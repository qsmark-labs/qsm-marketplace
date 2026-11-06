// elements: the one door through which another tool reads the C4 graph, every element with its
// id, kind, title and tags, and an actor's palette colour by name and hex, once the full lint
// passes.
import { type Finding, lintOutcome } from "../../../lib/model-graph.ts";
import { ok, type Outcome } from "../../../lib/outcome.ts";
import { PALETTE } from "../../../lib/palette.ts";
import { isActor, lintRead } from "./c4/lint.ts";
import { type C4Element, modelOrThrow, readC4 } from "./c4/model.ts";

interface Listed {
  readonly id: string;
  readonly kind: C4Element["kind"];
  readonly title: string;
  readonly tags: readonly string[];
  readonly colour?: { readonly name: string; readonly hex: string };
}

function listed(e: C4Element): Listed {
  const name = e.metadata.colour ?? "";
  const hex = isActor(e) ? PALETTE[name] : undefined;
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    tags: e.tags,
    ...(hex === undefined ? {} : { colour: { name, hex } }),
  };
}

const line = (e: Listed): string =>
  [e.id, e.kind, e.title, e.tags.join(","), e.colour === undefined ? "" : e.colour.name]
    .join("\t")
    .trimEnd();

/** A source lint refuses lists nothing and exits as the lint did. */
export async function listElements(
  file: string,
): Promise<Outcome<{ elements: Listed[] } | { findings: Finding[] }>> {
  const read = await readC4(file);
  const findings = lintRead(file, read);
  if (findings.length > 0) {
    return lintOutcome(file, findings);
  }
  const elements = modelOrThrow(file, read).elements.map(listed);
  return ok({ elements }, elements.map(line).join("\n"));
}
