#!/usr/bin/env bun

// qsm-tasks: the task port on GitHub issues and the board, one verb per step of the flow, so an
// agent never composes a gh, jq or GraphQL call itself.

import { type Call, type Handler, optionalString, runCli } from "../../../lib/cli-base.ts";
import type { Outcome } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import { flowOutcome } from "../lib/flow.ts";
import { connect } from "../lib/github/gh.ts";
import { resolveTarget } from "../lib/github/target.ts";
// A static import: bun's compiler inlines it, so `--help` needs no checkout in the room.
import manifestJson from "../qsm.json" with { type: "json" };
import { add, checkCreate, feature } from "./create.ts";
import { doctor } from "./doctor.ts";
import { checkEdit, close, edit } from "./edits.ts";
import { feedback } from "./feedback.ts";
import { setup } from "./setup.ts";
import { checkHuman, claim, human, plan, qa, reopen, review, unclaim } from "./moves.ts";
import type { At } from "./on-issue.ts";
import { checkSpec, list, note, ready, show } from "./reads.ts";

const manifest = parseManifest(manifestJson, "qsm-tasks/qsm.json");

/** A verb on the board: gh found, then the repository and the board resolved once, before it runs. */
function onBoard(
  verb: (call: Call, at: At) => Outcome | Promise<Outcome>,
  check: (call: Call) => void = () => {},
): Handler {
  return async (call) => {
    // a wrong call throws usage here, before any gh call
    check(call);
    const gh = connect();
    if (!gh.ok) {
      return gh.outcome;
    }
    // a verb that does not declare --repo or --project reads undefined: gh's repository, linked board
    const given = { repo: optionalString(call, "repo"), project: optionalString(call, "project") };
    const target = await resolveTarget(gh.value, given);
    return target.ok ? verb(call, { run: gh.value, target: target.value }) : target.outcome;
  };
}

if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-tasks", {
      ready: onBoard(ready),
      list: onBoard(list, checkSpec),
      show: onBoard(show),
      note: onBoard(note),
      feature: onBoard(feature, checkCreate),
      add: onBoard(add, checkCreate),
      edit: onBoard(edit, checkEdit),
      close: onBoard(close),
      flow: flowOutcome,
      claim: onBoard(claim),
      unclaim: onBoard(unclaim),
      review: onBoard(review),
      human: onBoard(human, checkHuman),
      reopen: onBoard(reopen),
      plan: onBoard(plan),
      qa: onBoard(qa),
      feedback,
      doctor: onBoard(doctor),
      setup: onBoard(setup),
    }),
  );
}
