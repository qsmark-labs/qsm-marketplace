![The plugins of the marketplace and what they depend on: only qsm-tasks talks to the task store
on GitHub](../feature-flow/models/marketplace.containers-depends.drawio.svg)

## Why

Every task of this project lives in `.beads/issues.jsonl`, a file each branch carries its own copy
of, and five plugins read or write it directly. The binary that talks to GitHub instead is the
feature `qsm-tasks-cli`. This feature is the move itself: the task tool stops being `br`, and "it is
not done if any step still needs `br`". After it, only `qsm-tasks` talks to the store, as the
picture above shows.

## What

- **The `task-tool` skill** names GitHub Issues as the task tool and a `qsm-tasks` verb for every
  step, says who acts and when, and tells the agent to run `qsm-tasks flow` for names and
  definitions instead of copying them.
- **The model in GitHub's terms**: a feature (issue type Feature) holds the intent, the models and
  the spec, bound by the label `change:<id>`; its tasks are sub-issues created when the owner and
  the agent split it, each closed by the merge of its pull request into `feature/<n>`; QA's
  verdict is a note that starts `QA passed`, after which the change is archived on the branch;
  the owner's merge of the feature pull request into main closes the feature. No test-it task, no
  tasks.md, no `accept`.
- **Feedback** is filed by `qsm-tasks feedback` into its own issue type, never by an issue number.
- **The readers of `br` go**: the worktree redirect, the task lines of `orient`, the cockpit's
  Tasks card, the lens's task reads; the lens keeps one write, a pen edit as a loose task.
- **The word feature replaces epic** in every skill, agent, instruction file and README.
- **The instruction file** names `qsm-tasks` and `qsm-memory` in its table "Where things live".
- **Evals** that scaffolded `br` get a fake `qsm-tasks` that records its arguments.

## Not in this feature

The binary, its flow table and its Action (`qsm-tasks-cli`, which this waits on), the triage of
the open `br` tasks and untracking `.beads/` (the migration, after this), the feature schema and
the steps of the flow (`feature-flow`), pull requests and review threads (qsm-forge), GitLab.

## Decisions of the owner

1. **GitHub is the task tool, `br` goes** (feature #3): "it is not done if any step
   still needs `br`".
2. **One door** (2026-10-30): "i still want my one tasks tool".
3. **The feature is bound to its change, tasks come at the split** (2026-11-01): the spec binds to
   the feature; tasks are created at step 3 by the owner and the implementation agent; tasks.md as
   a pre-written file goes.
