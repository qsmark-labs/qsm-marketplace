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
3. **The change lives on `feature/<n>` from the owner's yes, and is archived after the accept.**
   The planning session works in its own worktree (git rule 1) on the local branch `feature/<n>`
   cut from main; the owner's yes is given in the session (`plan.bpmn` 2.7), so no pull request
   carries the plan, and only then is the change committed. Step 3 pushes the branch. The lens
   reads local `feature/*` branches, so the plan shows before the push. A revision during the
   build is a commit on the branch. At step 9 the change is archived only after the owner accepts
   the feature pull request (`land.bpmn`), so a round of fixes never archives it twice (the archive
   rule is in `tasks-on-github-issues`).
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

## Decided by rule

1. **Pull requests merge with a merge commit**, task pull requests into `feature/<n>` and the
   feature pull request into main (git rule 1: merge, never rebase; the context rule takes a
   branch by merge commit).
2. **No issue form for feedback**: an agent files feedback through the task tool (CLAUDE.md), and
   `qsm-tasks feedback` checks for private data.
3. **A fake marker and a check** (not built): each fake carries `qsm-fake: #<task>` and a check on
   pull requests into main fails while one is left, because the gates check what a machine can
   (AGENTS.md).
4. **The three ways back are drawn**: the owner's comments on a task pull request
   (`build-task.bpmn` 6.2), changes asked on the feature pull request (`land.bpmn` 9.5), a plan
   the owner drops (`plan.bpmn` 2.10). A model that leaves them out would say less than happens.

## Critiques

- A custom schema ties the flow to openspec's experimental schema commands. Accepted: a break is
  loud at `openspec status`.
- Hash path ids are unreadable. Mitigated: a scenario title says the path in words.
