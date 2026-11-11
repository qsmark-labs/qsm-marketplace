Stub: Why, What, open decisions and one anchor requirement only. Planned after `feature-flow`;
models, specs and design come at its planning.

## Why

Step 8 of the flow has no owner yet. When the Action has brought `feature/<n>` up to date with main
and set Ready For Test, nothing tests the whole feature as a user meets it. QA catches contract and
business bugs, not code bugs. Code review already happened on every task; QA is the blackbox proof
that the feature does what its models say.

## What

- **A QA agent** (new, in qsm-review): it takes a feature from `qsm-tasks ready --qa`, runs `qa`,
  deploys the branch into a sandbox (a worktree of `feature/<n>`, a fresh Claude home, the
  marketplace installed from that worktree), and runs the spec scenarios that cite the cover
  paths of the feature's BPMN, as a user would, without reading the code.
- **A finding** is a fix task under the feature (`qsm-tasks add --feature`); no finding is a
  `note` on the feature whose first line is `QA passed`, one line per scenario with its evidence.
- **qsm-review depends on qsm-models** for the cover.

## Open decisions

1. **The sandbox**: a fresh `CLAUDE_CONFIG_DIR` and `HOME` under the session's temporary directory
   (recommended: cheap, cleaned after), or a container.
2. **Where QA runs**: on the owner's machine, started by the owner (recommended for now), or on a
   schedule on a dedicated machine.
3. **What makes a scenario runnable in a sandbox**: each BPMN task names the user action or the
   command that performs it, or the QA agent derives it from the scenario's WHEN.
4. **Which plugin owns the QA agent**: qsm-review, beside the agents that judge work and post
   nothing (recommended, and where the anchor requirement sits), or a plugin of its own.
