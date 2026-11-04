## Context

The behaviour is the spec and `models/feature-status.bpmn`; this file holds the decisions. Measured
on this repository: the default issue types Feature, Task and Bug, a Status field, the built-in
column Sub-issues progress, eight built-in workflows on, and `gh` 2.102.1 JSON with `parent`,
`subIssues`, `blockedBy`, `blocking` and `issueType`.

## Decisions

1. **One plugin, one binary, nineteen verbs; a flag before a verb.** A verb exists only for a flow
   step with its own guard (`claim`, `qa`); a read or an edit GitHub already models is a flag (a
   tree is `list --feature`, a deferral `unclaim --until`, a cancellation `close --not-planned`).
   Reason: the agent's raw route is the failure this removes, and hooks need `$.tasks`.
2. **The repository and the board are resolved, never stored**: `--repo`, else `gh`'s; `--project`,
   else the one linked board; ids read once per process. A stored default goes stale when the
   board moves, and it moved once. `feedback` always targets `QSM_MARKETPLACE`'s repository.
3. **One GraphQL query per read**, so a board of a hundred issues is one call, not N+1.
4. **The flow is a table in `lib/flow.ts`**: options, definitions per kind, guards, and the
   derivation as one function. The Action's script repeats the derivation, and `doctor` checks its
   names, because GitHub runs only `.github/`.
5. **A feature's Status is derived, and the Action is its only writer after planning.** The verb
   writes are `plan` and `qa`; everything else is the rule of the model, run on `issues: opened,
   closed, reopened` of a sub-issue, so the split's first task makes the feature In Dev as agreed.
   `qa` needs Ready For Test, which only the Action sets after a clean update from main.
   `edit --feature` moves an issue without an event, so both parents may lag until their next
   child event.
6. **The Action brings `feature/<n>` up to date with main** when the last task closes (agreed
   step 7). A conflict becomes a task under the feature, `Resolve the conflict of feature/<n> with
   main`, so it goes through the same build, review and merge as any task, the review agent first;
   its merge closes the last task again and the update runs again. The task is the Action's only
   post: it is how an agent learns of the conflict.
7. **The Action also closes what a merge into `feature/*` names.** GitHub closes `Closes #N` only
   on the default branch. On `pull_request: closed` with `merged` and a base `feature/*`, the
   Action closes each issue the body names as completed; "Item closed" then sets Done. One file,
   `.github/workflows/qsm-tasks.yml`, two jobs, the secret `PROJECT_TOKEN`.
8. **Accept is the owner's merge of the feature pull request into main.** Its `Closes #<feature>`
   is closed by GitHub itself, so no verb accepts and no Action job is needed for it.
9. **A change is bound to its feature by the label `change:<id>`**: planning binds the filed
   feature with `edit <n> --spec`; `feature --spec` is for a feature an agent creates when the
   owner asks in chat. `list --spec` reads it as one exact label search over open and closed
   issues. A task is never bound: it is a sub-issue of the bound feature.
10. **Cancel is a close as not planned**, never a Status; GitHub keeps the reason and the views
   filter by it.
11. **Done is GitHub's**: "Item closed" sets it for every kind; no verb writes Done and no verb adds
    to the board except `claim`, which may run before auto-add did.
12. **Errors**: `blocked` (`wrong-kind`, `wrong-status`, `held`, `private-data`), `missing`
    (`no-gh`, `no-repo`, `no-board`, `no-file`), `failed` (`refused`,
    `not-found`). No retry, no second route, no rollback; each write is idempotent, so a repeat
    finishes a half-done verb.
13. **`doctor` checks names, never descriptions; `setup` adds what is missing and never renames.**
    A check the API cannot answer is `manual` and `doctor` exits `partial`, never green on a guess.
14. **Feedback rules are data in `lib/feedback.ts`**: values, the template's sections, the
    private-data patterns. Feedback has no issue type: the label `feedback` names the kind.
15. **Ghost mode**: the binary's only own texts are the label `deferred` and the comment `Deferred
    until <value>`; `from:` names an agent by the owner's choice.

## Unmeasured, measured before the code

1. Can GraphQL add and rename a Status option, create the field Priority, and read the board's
   workflows and views? Each answer makes a `setup` and `doctor` line `ok` or `manual`.
2. Does an Action on `issues: opened` see the parent of an issue made with `add --feature`? If not,
   decision 5 is revised before the Action is built, with no silent second route.
3. Does `PROJECT_TOKEN` let the Action close the issues a merge into `feature/*` names, and push
   the merge of main into `feature/<n>`?
4. Which view filter separates issues closed as not planned (`reason:"not planned"`)?

## Open decisions

1. **Should a guard hook refuse raw `gh issue`, `gh project` and task `gh api` calls?** Recommended
   yes, in a later feature once the verbs have run live: a guard before the verbs are proven
   blocks the only way to file an issue.

## Critiques

- "Who may move what" cannot be enforced while the owner and the agent share one login. Fixed in
  part: the verbs enforce state; the owner's yes is a rule in the skill; a second identity is
  `agent-identity`.
- A failed Action run leaves a Status wrong. Fixed in part: it fails visibly in the Actions tab,
  and `qa` reads the sub-issues.
- One token writes the org board. Waived until `agent-identity`; it is a secret, never printed.
- Proof: one `bun test` through `runBin` with a recording fake `gh` per guard a live run cannot
  show without writing to the public repository, the model's eleven paths as the derivation's
  test table, and one live loop on `qsmark-labs/qsm-marketplace` with `test:` issues closed after.
