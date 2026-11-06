#!/usr/bin/env bun

// qsm-c4: lint and render the project's C4 graph, and write the page that shows it.

import { flagArg, optionalString, runCli } from "../../../lib/cli-base.ts";
import { lintOutcome } from "../../../lib/model-graph.ts";
import { doctorVerdict } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import { C4 } from "../lib/notation.ts";
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-c4/qsm.json");

// each verb loads its own modules when it runs, so `doctor` does not pay for LikeC4 and the
// renderer it never calls
if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-c4", {
      doctor: () => doctorVerdict("qsm-c4", []),
      lint: async (call) => {
        const file = C4.graph(optionalString(call, "path"));
        return lintOutcome(file, await (await import("../lib/c4/lint.ts")).lintC4(file));
      },
      render: async (call) =>
        (await import("../lib/render.ts")).renderFile(
          C4.graph(optionalString(call, "path")),
          flagArg(call, "check"),
        ),
      elements: async (call) =>
        (await import("../lib/elements.ts")).listElements(C4.graph(optionalString(call, "path"))),
      pages: async (call) =>
        (await import("../lib/pages/pages.ts")).writePages(C4.root(), optionalString(call, "out")),
    }),
  );
}
