#!/usr/bin/env bun

// qsm-models: lint, lay out, render, walk and check the project's BPMN and C4 graphs, and write
// the pages that show them.

import { flagArg, optionalString, requiredString, runCli } from "../../../lib/cli-base.ts";
import { doctorVerdict } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import { MODELS_DIR, oneGraph } from "../lib/graphs.ts";
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-models/qsm.json");

// each verb loads its own modules when it runs, so `doctor` and `paths` do not pay for the C4 and
// BPMN renderers they never call
if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-models", {
      doctor: () => doctorVerdict("qsm-models", []),
      lint: async (call) =>
        (await import("../lib/lint.ts")).lintPath(optionalString(call, "path") ?? MODELS_DIR),
      layout: async (call) =>
        (await import("../lib/bpmn/layout.ts")).layoutFile(requiredString(call, "file")),
      render: async (call) =>
        (await import("../lib/render.ts")).renderPath(
          optionalString(call, "path") ?? MODELS_DIR,
          flagArg(call, "check"),
        ),
      paths: async (call) =>
        (await import("../lib/paths.ts")).pathsOf({
          file: optionalString(call, "file") ?? oneGraph(MODELS_DIR, ".bpmn"),
          process: optionalString(call, "process"),
          all: flagArg(call, "all"),
          specs: optionalString(call, "specs"),
        }),
      check: async () => {
        const { checkProject, repoRoot } = await import("../lib/conform.ts");
        return checkProject(repoRoot());
      },
      pages: async (call) => {
        const { repoRoot } = await import("../lib/conform.ts");
        return (await import("../lib/pages/pages.ts")).writePages(
          repoRoot(),
          optionalString(call, "out"),
        );
      },
    }),
  );
}
