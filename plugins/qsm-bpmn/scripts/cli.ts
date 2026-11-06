#!/usr/bin/env bun

// qsm-bpmn: lint, lay out, render and walk the project's BPMN graph, and write the page that shows
// it.

import {
  type Call,
  flagArg,
  optionalString,
  requiredString,
  runCli,
} from "../../../lib/cli-base.ts";
import { graphOf, lintOutcome, modelsDir, repoRoot } from "../../../lib/model-graph.ts";
import { doctorVerdict } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-bpmn/qsm.json");

/** The graph a verb runs on: its path argument, or the project's one graph. */
const graphArg = (call: Call, name: string): string =>
  graphOf(optionalString(call, name) ?? modelsDir("qsm-bpmn"), ".bpmn");

// each verb loads its own modules when it runs, so `doctor` and `paths` do not pay for the
// renderer they never call
if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-bpmn", {
      doctor: () => doctorVerdict("qsm-bpmn", []),
      lint: async (call) => {
        const file = graphArg(call, "path");
        return lintOutcome(file, await (await import("../lib/lint.ts")).lintFile(file));
      },
      layout: async (call) =>
        (await import("../lib/bpmn/layout.ts")).layoutFile(requiredString(call, "file")),
      render: async (call) =>
        (await import("../lib/render.ts")).renderFile(
          graphArg(call, "path"),
          flagArg(call, "check"),
        ),
      paths: async (call) =>
        (await import("../lib/paths.ts")).pathsOf({
          file: graphArg(call, "file"),
          process: optionalString(call, "process"),
          all: flagArg(call, "all"),
          specs: optionalString(call, "specs"),
        }),
      pages: async (call) =>
        (await import("../lib/pages/pages.ts")).writePages(
          repoRoot("qsm-bpmn"),
          optionalString(call, "out"),
        ),
    }),
  );
}
