#!/usr/bin/env bun

// qsm-c4: lint and render the project's C4 graph, and write the page that shows it.

import { type Call, flagArg, optionalString, runCli } from "../../../lib/cli-base.ts";
import { graphOf, lintOutcome, modelsDir, repoRoot } from "../../../lib/model-graph.ts";
import { doctorVerdict } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-c4/qsm.json");

/** The graph a verb runs on: its path argument, or the project's one graph. */
const graphArg = (call: Call): string =>
  graphOf(optionalString(call, "path") ?? modelsDir("qsm-c4"), ".c4");

// each verb loads its own modules when it runs, so `doctor` does not pay for LikeC4 and the
// renderer it never calls
if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-c4", {
      doctor: () => doctorVerdict("qsm-c4", []),
      lint: async (call) => {
        const file = graphArg(call);
        return lintOutcome(file, await (await import("../lib/c4/lint.ts")).lintC4(file));
      },
      render: async (call) =>
        (await import("../lib/render.ts")).renderFile(graphArg(call), flagArg(call, "check")),
      pages: async (call) =>
        (await import("../lib/pages/pages.ts")).writePages(
          repoRoot("qsm-c4"),
          optionalString(call, "out"),
        ),
    }),
  );
}
