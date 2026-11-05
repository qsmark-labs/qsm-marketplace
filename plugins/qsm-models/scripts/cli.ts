#!/usr/bin/env bun

// qsm-models: lint, lay out, render, walk and check the project's BPMN and C4 graphs, and write
// the pages that show them.

import { flagArg, optionalString, requiredString, runCli } from "../../../lib/cli-base.ts";
import { doctorVerdict, fail } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import { MODELS_DIR } from "../lib/graphs.ts";
import { layoutFile } from "../lib/bpmn/layout.ts";
import { lintPath } from "../lib/lint.ts";
import { renderPath } from "../lib/render.ts";
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-models/qsm.json");

const notBuilt = (verb: string) => () => fail("missing", `qsm-models ${verb} is not built yet`);

if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-models", {
      doctor: () => doctorVerdict("qsm-models", []),
      lint: (call) => lintPath(optionalString(call, "path") ?? MODELS_DIR),
      layout: (call) => layoutFile(requiredString(call, "file")),
      render: (call) =>
        renderPath(optionalString(call, "path") ?? MODELS_DIR, flagArg(call, "check")),
      paths: notBuilt("paths"),
      check: notBuilt("check"),
      pages: notBuilt("pages"),
    }),
  );
}
