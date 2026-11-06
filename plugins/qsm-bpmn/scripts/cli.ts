#!/usr/bin/env bun

// qsm-bpmn: lint, lay out, render and walk the project's BPMN graph, and write the page that shows
// it.

import { flagArg, optionalString, requiredString, runCli } from "../../../lib/cli-base.ts";
import { lintOutcome } from "../../../lib/model-graph.ts";
import { doctorVerdict } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import { BPMN } from "../lib/notation.ts";
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-bpmn/qsm.json");

// each verb loads its own modules when it runs, so `doctor` and `paths` do not pay for the
// renderer they never call
if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-bpmn", {
      doctor: () => doctorVerdict("qsm-bpmn", []),
      lint: async (call) => {
        const graph = await (
          await import("../lib/bpmn/model.ts")
        ).readGraph(BPMN.graph(optionalString(call, "path")));
        return lintOutcome(graph.file, await (await import("../lib/lint.ts")).lintGraph(graph));
      },
      layout: async (call) =>
        (await import("../lib/bpmn/layout.ts")).layoutFile(requiredString(call, "file")),
      render: async (call) =>
        (await import("../lib/render.ts")).renderFile(
          BPMN.graph(optionalString(call, "path")),
          flagArg(call, "check"),
        ),
      paths: async (call) =>
        (await import("../lib/paths.ts")).pathsOf({
          file: BPMN.graph(optionalString(call, "file")),
          process: optionalString(call, "process"),
          all: flagArg(call, "all"),
          specs: optionalString(call, "specs"),
        }),
      pages: async (call) =>
        (await import("../lib/pages/pages.ts")).writePages(
          BPMN.root(),
          optionalString(call, "out"),
        ),
    }),
  );
}
