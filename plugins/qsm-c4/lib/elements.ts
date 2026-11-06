// elements: the one door through which another tool reads the C4 graph, every element with its
// id, kind, title and tags, and an actor's palette colour by name and hex.
import { ok, type Outcome } from "../../../lib/outcome.ts";
import { PALETTE } from "../../../lib/palette.ts";
import { isActor } from "./c4/lint.ts";
import { type C4Element, readC4OrThrow } from "./c4/model.ts";

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

export async function listElements(file: string): Promise<Outcome<{ elements: Listed[] }>> {
  const elements = (await readC4OrThrow(file)).elements.map(listed);
  return ok({ elements }, elements.map(line).join("\n"));
}
