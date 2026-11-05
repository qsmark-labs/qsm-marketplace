// What every qsm-models test starts from: the real entry, and the real planning process.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CLI = resolve(import.meta.dir, "../cli.ts");
export const PLAN = readFileSync(resolve(import.meta.dir, "plan.bpmn"), "utf8");
