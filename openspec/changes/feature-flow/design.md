## Context

The behaviour is `models/flow.bpmn` and the spec, the structure `models/marketplace.c4`; this file
holds the decisions. Reused as they are: grilling, the worker agents, received-findings,
review-threads, `/simplify`, the review skill. Nothing in `.github/` but `ci.yml` exists.

## Decisions

1. **A feature is an OpenSpec change on the project schema `feature`**: proposal, models, specs,
   design; `apply.requires: [design]`, `apply.tracks: null`. Rejected: `spec-driven` (it writes
   tasks.md ahead, which the owner removed) and no OpenSpec. Measured on 1.6.0: the schema
   validates, `status` lists four artifacts, `validate --strict` passes with no tasks.md.
2. **Models come before specs.** `specs` requires `models`, so the SHALL text is written against
   a drawn process. `flow.bpmn` models our own process, not product behaviour: its cover paths
   are the scenarios of this spec. A product feature's BPMN models what QA runs.
3. **The change reaches main before the build, and is archived at step 9.** Planning opens the
   change as a pull request to main; the owner's merge is his yes to the plan, the lens on main
   shows it, and the issue's picture links resolve. The split branches `feature/<n>` from main, a
   revision during the build is a commit on that branch, and at step 9 the agent archives the
   change there and opens the feature pull request (the archive rule is in
   `tasks-on-github-issues`).
4. **Tasks are cut at the split, on the board.** `qsm-tasks add --feature <n>` with `--after`
   for order; the first sub-issue makes the feature In Dev (the Action). A task is one concern
   the owner reads in one sitting, and every fake it adds has a later task that replaces it, so
   none reaches main.
5. **A task is built by a main session, which opens its pull request** into `feature/<n>` through
   a new `qsm-forge gh pr-open`; a worker it starts never pushes. One context holds the why from
   gathering to the pull request, and the forge stays the door to pull requests. The git rule
   changes to say so.
6. **The whiteboard is in the chat, not a file**: the C4 component view of what the task touches,
   the interfaces, where each lives, the contracts. When components change, the plugin's C4 model
   changes in the same pull request. A plan file would be the tasks.md the owner removed.
7. **Review reuses workflow-review**, reading the feature's change as what was asked. It posts
   under the owner's login until `agent-identity`.
8. **Forms and template.** Issue forms carry the six questions and set the issue type; the pull
   request template has Before, After, What it solves, Closes. GitHub closes the feature itself on
   the feature pull request's merge into main; the Action of `qsm-tasks-cli` closes task pull
   requests merged into `feature/*`.
9. **Dependencies.** qsm-openspec gains `qsm-models` (spec-propose lints, renders and walks) and
   `qsm-forge` (spec-apply opens the pull request), both declared in its Dependencies.

Skills changed here: `plan`, `spec-propose`, `spec-apply`, `workflow-review`, the git rule;
elsewhere: `task-tool`, `spec-archive` (`tasks-on-github-issues`). New elsewhere: the QA agent
(`qa-agent`), the `qsm-models` plugin. New verb: `qsm-forge gh pr-open`.

## Verify, before the first task is built

1. Does `type: Feature` in an issue form set the issue type? Proof: one form on a test repository
   and `gh issue view --json issueType`. If it does not, the spec is revised; there is no second
   path that sets it.

## Open decisions

1. **When is `feature/<n>` created?** At the split from main, as agreed (built). Alternative: at
   the end of planning, with the change committed on the branch; main then never holds a plan for
   unbuilt code, but the lens on main and the issue's links do not show it until the feature
   merges.
2. **How do pull requests merge?** Recommended: task pull requests squash into `feature/<n>`, the
   feature pull request merges into main with a merge commit. Alternative: everything squashes.
3. **An issue form for feedback?** Recommended no: `qsm-tasks feedback` checks for private data.
4. **A fake marker and a check** (not built): each fake carries `qsm-fake: #<task>` and a check on
   pull requests into main fails while one is left. Recommended yes, because "fakes never reach
   main" is otherwise checked by reading.
5. **Ways back the agreed flow does not draw** (not built): the owner asks for changes on a task
   pull request; the owner rejects the feature pull request as a fix task under the feature; a
   plan the owner drops (closed as not planned). Recommended: all three, as written, because
   GitHub offers the first and the others need one rule each.

## Critiques

- A custom schema ties the flow to openspec's experimental schema commands. Accepted: a break is
  loud at `openspec status`.
- Hash path ids are unreadable. Mitigated: a scenario title says the path in words.
