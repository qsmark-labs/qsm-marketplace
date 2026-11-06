## Context

The behaviour is `feature_flow_process` of `models/marketplace.bpmn` and the spec, the structure
`models/marketplace.c4`; this file holds the decisions. Reused as they are: grilling, the worker
agents, received-findings, review-threads, `/simplify`, the review skill. Nothing in `.github/` but
`ci.yml` exists.

## Decisions

1. **A feature is an OpenSpec change on the project schema `feature`**: proposal, models, specs,
   design; `apply.requires: [design]`, `apply.tracks: null`. Rejected: `spec-driven` (it writes
   tasks.md ahead, which the owner removed) and no OpenSpec. Measured on 1.6.0: the schema
   validates, `status` lists four artifacts, `validate --strict` passes with no tasks.md.
2. **Models come before specs.** `specs` requires `models`, so the SHALL text is written against a
   drawn process. `feature_flow_process` of `models/marketplace.bpmn` models our own process, not
   product behaviour: its cover paths are the scenarios of this spec. A product feature's BPMN
   models what QA runs.
3. **The change lives on `feature/<n>` from the owner's yes, and is archived after the accept.** The
   planning session works in its own worktree (git rule 1) on the local branch `feature/<n>` cut
   from main; the owner's yes is given in the session (`plan_process` 2.7), so no pull request
   carries the plan, and only then is the change committed. Step 3 pushes the branch. The lens shows
   the branch the checkout is on, so the plan shows before the push. A revision during the build is
   a commit on the branch. At step 9 the change is archived only after the owner accepts the feature
   pull request (`land_process`), so a round of fixes never archives it twice (the archive rule is
   in `tasks-on-github-issues`).
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

## The owner's answers

1. **A pull request may squash.** A squash merge writes one new commit on the target and rewrites
   nothing, so the git rule's "never rebase" does not touch it.
2. **Feedback is a plain issue from a template**: what happened, where, how to reproduce it in the
   abstract, and what it should do. No custom issue type. This changes the Feedback type of
   `qsm-tasks-cli`, which follows when the flow is approved.
3. **Fakes and mocks need no marker.** They are allowed on task branches, and the review catches
   one that is left before the feature pull request reaches main.
4. **Versions and a release train wait** for a full release flow of an app; the marketplace has
   none yet.
5. **The three ways back are drawn**: the owner's comments on a task pull request
   (`build_task_process` 6.2), changes asked on the feature pull request (`land_process` 9.5), a
   plan the owner drops (`plan_process` 2.10). A model that leaves them out would say less than
   happens.

## Critiques

- A custom schema ties the flow to openspec's experimental schema commands. Accepted: a break is
  loud at `openspec status`.
- Hash path ids are unreadable. Mitigated: a scenario title says the path in words.
