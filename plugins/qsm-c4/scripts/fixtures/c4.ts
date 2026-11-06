// What every qsm-c4 test starts from: the real entry and the marketplace's own C4 graph.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CLI = resolve(import.meta.dir, "../cli.ts");
export const C4 = readFileSync(
  resolve(import.meta.dir, "../../../../models/marketplace.c4"),
  "utf8",
);
