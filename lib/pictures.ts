// The pictures a render writes beside a graph: each written, or compared with what is there under
// --check, and every picture of the project's name that no render writes named, never deleted.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeAtomic } from "./fs.ts";
import { fail, ok, type Outcome } from "./outcome.ts";

/** One picture a render writes: the file name beside the graph, and its bytes. */
export interface Picture {
  readonly name: string;
  readonly title: string;
  readonly svg: string;
}

export interface Settled {
  written: string[];
  stale: string[];
  orphans: string[];
}

export interface PictureKind {
  /** the binary that writes them, named in the stale line */
  readonly tool: string;
  /** whether a file beside the graph that carries the project's name is a picture of this kind */
  readonly owns: (file: string) => boolean;
}

/** One graph's pictures settled: under `check` each wrong picture is named stale; otherwise every
 * picture is written. An orphan is only named, never deleted, because a file that merely carries
 * the project's name may be one the person made. */
export function settlePictures(
  graph: string,
  project: string,
  pictures: readonly Picture[],
  check: boolean,
  kind: PictureKind,
): Outcome<Settled> {
  const dir = dirname(graph);
  const current = new Set(pictures.map((p) => p.name));
  const orphans = readdirSync(dir)
    .filter((f) => f.startsWith(`${project}.`) && kind.owns(f) && !current.has(f))
    .toSorted()
    .map((f) => join(dir, f));
  const result: Settled = { written: [], stale: [], orphans };
  for (const p of pictures) {
    const out = join(dir, p.name);
    if (!check) {
      writeAtomic(out, p.svg);
      result.written.push(out);
    } else if (!existsSync(out) || readFileSync(out, "utf8") !== p.svg) {
      result.stale.push(out);
    }
  }
  const { written, stale } = result;
  const problems = [
    ...(stale.length > 0 ? [`stale, run ${kind.tool} render: ${stale.join(", ")}`] : []),
    ...(orphans.length > 0
      ? [`no render writes these, delete them if they are old pictures: ${orphans.join(", ")}`]
      : []),
  ];
  if (problems.length > 0) {
    return fail("worse", problems.join("\n"), result);
  }
  return ok(result, check ? "every picture is current" : `wrote ${written.join(", ")}`);
}
