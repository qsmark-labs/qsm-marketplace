#!/usr/bin/env bun

// qsm-tasks: the task port on GitHub issues and the board, one verb per step of the flow, so an
// agent never composes a gh, jq or GraphQL call itself.

import { type Call, type Handler, runCli } from "../../../lib/cli-base.ts";
import { fail, type Outcome } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import { connect, type Run } from "../lib/github/gh.ts";
// A static import: bun's compiler inlines it, so `--help` needs no checkout in the room.
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-tasks/qsm.json");

interface OnBoard {
  readonly call: Call;
  readonly run: Run;
}

/** A verb on the board: gh found first, or `missing` `no-gh` and nothing runs. */
function onBoard(verb: (at: OnBoard) => Outcome | Promise<Outcome>): Handler {
  return (call) => {
    const gh = connect();
    return gh.ok ? verb({ call, run: gh.value }) : gh.outcome;
  };
}

/** A declared verb whose task has not landed yet: it fails naming that task. */
function notBuilt(issue: number): (at: { readonly call: Call }) => Outcome {
  return ({ call }) =>
    fail("failed", `${call.verb}: not built yet, see issue #${issue}`, { reason: "not-built" });
}

if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-tasks", {
      ready: onBoard(notBuilt(40)),
      list: onBoard(notBuilt(40)),
      show: onBoard(notBuilt(40)),
      note: onBoard(notBuilt(40)),
      feature: onBoard(notBuilt(41)),
      add: onBoard(notBuilt(41)),
      edit: onBoard(notBuilt(41)),
      close: onBoard(notBuilt(41)),
      flow: (call) => notBuilt(42)({ call }),
      claim: onBoard(notBuilt(43)),
      unclaim: onBoard(notBuilt(43)),
      review: onBoard(notBuilt(43)),
      human: onBoard(notBuilt(43)),
      reopen: onBoard(notBuilt(43)),
      plan: onBoard(notBuilt(43)),
      qa: onBoard(notBuilt(43)),
      feedback: (call) => notBuilt(44)({ call }),
      doctor: onBoard(notBuilt(45)),
      setup: onBoard(notBuilt(45)),
    }),
  );
}
