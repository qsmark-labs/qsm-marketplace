// The render verb: every view of the graph, written beside it, or compared with what is there
// under --check.
import { projectOf } from "../../../lib/model-graph.ts";
import type { Outcome } from "../../../lib/outcome.ts";
import { type Settled, settlePictures } from "../../../lib/pictures.ts";
import { readC4OrThrow } from "./c4/model.ts";
import { renderC4 } from "./c4/render.ts";

/** A C4 view beside the graph; the other `.svg` files there are another notation's. */
const owns = (file: string): boolean => file.endsWith(".drawio.svg");

/** A source LikeC4 refuses renders nothing and says why. */
export async function renderFile(file: string, check: boolean): Promise<Outcome<Settled>> {
  const project = projectOf(file, ".c4");
  const views = await renderC4(await readC4OrThrow(file), project);
  return settlePictures(file, project, views, check, { tool: "qsm-c4", owns });
}
