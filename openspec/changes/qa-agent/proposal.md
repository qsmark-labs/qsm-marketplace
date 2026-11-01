Stub: Why, What, open decisions and one anchor requirement only. Planned after `feature-flow`;
models, specs and design come at its planning.

## Why

Steps 7 and 8 of the flow have no owner yet. When the last task of a feature merges, nothing
brings `feature/<n>` up to date with main, and nothing tests the whole feature as a user meets
it. The owner: "QA ma chytat contract a business bugs, ne codebugs" (QA catches contract and
business bugs, not code bugs). Code review already happened on every task; QA is the blackbox
proof that the feature does what its models say.

## What

- **Step 7**: when the Action sets Ready For Test, `feature/<n>` is brought up to date with main;
  a conflict is resolved in a pull request the review agent reviews first and the owner merges.
- **Step 8, a QA agent** (new): it takes a feature from `qsm-tasks ready --qa`, deploys the branch
  into a sandbox (a worktree of `feature/<n>`, a fresh Claude home, the marketplace installed from
  that worktree), and runs one headless session per path that `qsm-models paths` lists for the
  feature's BPMN, as a user would, without reading the code.
- **A finding** is a fix task under the feature (`qsm-tasks add --feature`); no finding is a
  report to the owner with one line per path and its evidence, for the feature pull request.

## Open decisions

1. **Who runs step 7**: the Action merges main into `feature/<n>` (recommended: no agent needed
   when there is no conflict), or the QA agent before it deploys.
2. **The sandbox**: a fresh `CLAUDE_CONFIG_DIR` and `HOME` under the session's temporary directory
   (recommended: cheap, cleaned after), or a container.
3. **Where QA runs**: on the owner's machine, started by the owner (recommended for now), or on a
   schedule on a dedicated machine.
4. **What a path needs to be runnable**: each BPMN task names the user action or the command that
   performs it, or the QA agent derives the action from the spec scenario that cites the path.
5. **Which plugin owns the QA agent**: qsm-review, beside the agents that judge work and post
   nothing (recommended, and where the one anchor requirement sits), or a plugin of its own.
