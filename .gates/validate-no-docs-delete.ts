#!/usr/bin/env bun
// Only the owner deletes a snapshot of qsm-docs: the agent is denied `qsm-docs delete` by a hook, so
// no skill, agent, command or hook of the marketplace may tell it to run one or call the noun's
// `$.docs.delete`. A hook's test drives the guard with the line on purpose and is not a call.
import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import { pluginsDir, rel, report, walk } from "./walk.ts";

const CALL = /qsm-docs\s+delete\b|\$\.docs\.delete\b/;
const SURFACES = new Set(["skills", "agents", "commands", "hooks"]);

/** `<file>:<line>` for every line of a skill, agent, command or hook under `dir` that deletes. */
export function deleteCalls(dir: string): string[] {
  const findings: string[] = [];
  for (const file of walk(dir)) {
    const surface = relative(dir, file).split(sep)[1] ?? "";
    if (!SURFACES.has(surface) || /\.test\.tsx?$/.test(file)) {
      continue;
    }
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (CALL.exec(line) !== null) {
          findings.push(`${rel(file)}:${i + 1}`);
        }
      });
  }
  return findings;
}

if (import.meta.main) {
  report(
    "no-docs-delete",
    deleteCalls(pluginsDir).map(
      (at) =>
        `${at}: calls qsm-docs delete; only the owner deletes a snapshot, with ! in his shell`,
    ),
  );
}
