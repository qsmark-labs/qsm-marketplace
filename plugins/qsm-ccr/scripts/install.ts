#!/usr/bin/env bun
// The shared install base compiles qsm-ccr into the bin directory and writes its completion. The
// three upstream tools are probed, never installed and never run: any ccr invocation can start the
// daemon before activation's guard holds.
import { installScript } from "../../../lib/install-base.ts";
import { cleanOldHomes } from "../lib/claude-home.ts";
import { placesOf, UPSTREAM } from "../lib/places.ts";

export const install = installScript(import.meta, {
  upstream: UPSTREAM,
  extra: (ctx) => {
    const homes = cleanOldHomes(placesOf(ctx.env), ctx.dryRun);
    return {
      name: "old homes",
      status: homes.length === 0 ? "already" : ctx.dryRun ? "skipped" : "installed",
      detail:
        homes.length === 0
          ? "no home of the shape before the pid name"
          : `${ctx.dryRun ? "would clean" : "cleaned"} ${homes.length} home(s) of the shape before the pid name`,
    };
  },
});
