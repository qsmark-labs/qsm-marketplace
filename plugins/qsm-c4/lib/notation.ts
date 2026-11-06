// C4 as qsm-c4 serves it: the graph file and the views beside it.
import { notation } from "../../../lib/model-graph.ts";

/** A view is `<project>.*.drawio.svg`; the other `.svg` files there are another notation's. */
export const C4 = notation({
  ext: ".c4",
  tool: "qsm-c4",
  owns: (file) => file.endsWith(".drawio.svg"),
});
