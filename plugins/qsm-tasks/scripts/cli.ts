#!/usr/bin/env bun

// qsm-tasks: the board's work from a shell.

import { optionalNumber, requiredNumber, requiredString, runCli } from "../../../lib/cli-base.ts";
import { checkTools, doctorVerdict, ok } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import { addIssue } from "../lib/add.ts";
import { runGh } from "../lib/gh.ts";
import { lineOf, parseIssues } from "../lib/issues.ts";
import { moveIssue } from "../lib/move.ts";
import manifestJson from "../qsm.json" with { type: "json" };

process.exit(
  await runCli(parseManifest(manifestJson), "qsm-tasks", {
    doctor: () =>
      doctorVerdict("qsm-tasks", checkTools([{ cmd: "gh", hint: "install the GitHub CLI" }])),
    list: () => {
      const issues = parseIssues(
        runGh([
          "issue",
          "list",
          "--state",
          "open",
          "--limit",
          "1000",
          "--json",
          "number,title,projectItems",
        ]),
      );
      return ok(issues, issues.map(lineOf).join("\n"));
    },
    add: (call) => {
      const number = addIssue(
        requiredString(call, "title"),
        requiredString(call, "bodyFile"),
        optionalNumber(call, "parent"),
      );
      return ok(number, String(number));
    },
    move: (call) => {
      const number = requiredNumber(call, "number");
      const status = requiredString(call, "status");
      moveIssue(number, status);
      return ok(undefined, `#${number} ${status}`);
    },
  }),
);
