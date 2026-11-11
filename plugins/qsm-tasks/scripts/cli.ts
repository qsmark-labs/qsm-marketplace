#!/usr/bin/env bun

// qsm-tasks: the task port on GitHub issues and the board, one verb per step of the flow, so an
// agent never composes a gh, jq or GraphQL call itself.

import { type Call, runCli } from "../../../lib/cli-base.ts";
import { fail, type Outcome } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
// A static import: bun's compiler inlines it, so `--help` needs no checkout in the room.
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-tasks/qsm.json");

/** A declared verb whose task has not landed yet: it fails naming that task. */
function notBuilt(issue: number): (call: Call) => Outcome {
  return (call) =>
    fail("failed", `${call.verb}: not built yet, see issue #${issue}`, { reason: "not-built" });
}

if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-tasks", {
      ready: notBuilt(40),
      list: notBuilt(40),
      show: notBuilt(40),
      note: notBuilt(40),
      feature: notBuilt(41),
      add: notBuilt(41),
      edit: notBuilt(41),
      close: notBuilt(41),
      flow: notBuilt(42),
      claim: notBuilt(43),
      unclaim: notBuilt(43),
      review: notBuilt(43),
      human: notBuilt(43),
      reopen: notBuilt(43),
      plan: notBuilt(43),
      qa: notBuilt(43),
      feedback: notBuilt(44),
      doctor: notBuilt(45),
      setup: notBuilt(45),
    }),
  );
}
