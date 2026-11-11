#!/usr/bin/env bun

// qsm-tasks: the task port on GitHub issues and the board, one verb per step of the flow, so an
// agent never composes a gh, jq or GraphQL call itself.

import { type Call, type Handler, optionalString, runCli } from "../../../lib/cli-base.ts";
import { fail, type Outcome, ok } from "../../../lib/outcome.ts";
import { MOVES, PRIORITIES, renderFlow, STATUSES } from "../lib/flow.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import { connect, type Run } from "../lib/github/gh.ts";
import { resolveTarget, type Target } from "../lib/github/target.ts";
// A static import: bun's compiler inlines it, so `--help` needs no checkout in the room.
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-tasks/qsm.json");

interface OnBoard {
  readonly call: Call;
  readonly run: Run;
  readonly target: Target;
}

/** A verb on the board: gh found, then the repository and the board resolved once, before it runs. */
function onBoard(verb: (at: OnBoard) => Outcome | Promise<Outcome>): Handler {
  return async (call) => {
    const gh = connect();
    if (!gh.ok) {
      return gh.outcome;
    }
    const given = { repo: optionalString(call, "repo"), project: optionalString(call, "project") };
    const target = await resolveTarget(gh.value, given);
    return target.ok ? verb({ call, run: gh.value, target: target.value }) : target.outcome;
  };
}

/** A declared verb whose task has not landed yet: it fails naming that task. */
function notBuilt(
  issue: number,
): (at: { readonly call: Call; readonly target?: Target }) => Outcome {
  return ({ call, target }) => {
    const on =
      target === undefined
        ? ""
        : ` on ${target.repo}, board ${target.board.owner}/${target.board.number}`;
    return fail("failed", `${call.verb}${on}: not built yet, see issue #${issue}`, {
      reason: "not-built",
    });
  };
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
      flow: () => ok({ statuses: STATUSES, moves: MOVES, priorities: PRIORITIES }, renderFlow()),
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
