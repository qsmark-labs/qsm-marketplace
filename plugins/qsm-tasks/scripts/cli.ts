#!/usr/bin/env bun

// qsm-tasks: the board's work from a shell.

import { runCli } from "../../../lib/cli-base.ts";
import { checkTools, doctorVerdict } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import manifestJson from "../qsm.json" with { type: "json" };

process.exit(
  await runCli(parseManifest(manifestJson), "qsm-tasks", {
    doctor: () =>
      doctorVerdict("qsm-tasks", checkTools([{ cmd: "gh", hint: "install the GitHub CLI" }])),
  }),
);
