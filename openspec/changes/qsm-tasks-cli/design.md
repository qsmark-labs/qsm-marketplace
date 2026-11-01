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
   writes are the human acts (`claim` of the first task, `plan`, `qa`); everything else is the
   rule of the model, run on `issues: opened, closed, reopened` of a sub-issue. `qa` reads the
   sub-issues with the same predicate, so QA never waits for the Action. `edit --feature` moves an
   issue without an event, so both parents may lag until their next child event; `qa` never
   trusts the stored Status alone.
6. **The Action also closes what a merge into `feature/*` names.** GitHub closes `Closes #N` only
   on the default branch. On `pull_request: closed` with `merged` and a base `feature/*`, the
   Action closes each issue the body names as completed; "Item closed" then sets Done. One file,
   `.github/workflows/qsm-tasks.yml`, two jobs, the secret `PROJECT_TOKEN`.
7. **Accept is the owner's merge of the feature pull request into main.** Its `Closes #<feature>`
   is closed by GitHub itself, so no verb accepts and no Action job is needed for it.
8. **A change is bound to its feature by the label `change:<id>`**, written by `feature --spec`
   and `edit <feature> --spec`, read by `list --spec` as one exact label search over open and
   closed issues. A task is never bound: it is a sub-issue of the bound feature.
9. **Cancel is a close as not planned**, never a Status; GitHub keeps the reason and the views
   filter by it.
10. **Done is GitHub's**: "Item closed" sets it for every kind; no verb writes Done and no verb adds
    to the board except `claim`, which may run before auto-add did.
11. **Errors**: `blocked` (`wrong-kind`, `wrong-status`, `held`, `private-data`), `missing`
    (`no-gh`, `no-repo`, `no-board`, `no-feedback-type`, `no-file`), `failed` (`refused`,
    `not-found`). No retry, no second route, no rollback; each write is idempotent, so a repeat
    finishes a half-done verb.
12. **`doctor` checks names, never descriptions; `setup` adds what is missing and never renames.**
    A check the API cannot answer is `manual` and `doctor` exits `partial`, never green on a guess.
13. **Feedback rules are data in `lib/feedback.ts`**: values, sections, the private-data patterns.
14. **Ghost mode**: the binary's only own texts are the label `deferred` and the comment `Deferred
    until <value>`; `from:` names an agent by the owner's choice.

## Unmeasured, measured before the code

1. Can GraphQL add and rename a Status option, create the issue type Feedback and the field
   Priority, and read the board's workflows and views? Each answer makes a `setup` and `doctor`
   line `ok` or `manual`.
2. Does an Action on `issues: opened` see the parent of an issue made with `add --feature`? If not,
   decision 5 is revised before the Action is built, with no silent second route.
3. Does the token of a merge into `feature/*` let the Action close the named issues? The
   `PROJECT_TOKEN` is the expected answer.
4. Which view filter separates issues closed as not planned (`reason:"not planned"`)?

## Open decisions

1. **Should a guard hook refuse raw `gh issue`, `gh project` and task `gh api` calls?** Recommended
   yes, in a later feature once the verbs have run live: a guard before the verbs are proven
   blocks the only way to file an issue.

## Critiques

- Nineteen verbs is a contract forever. Waived: each verb is a flow step with a guard; reads and
  edits are flags, and every verb that duplicated `show`, `list` or `add` was cut.
- "Who may move what" cannot be enforced while the owner and the agent share one login. Fixed in
  part: the verbs enforce state; the owner's yes is a rule in the skill; a second identity is
  `agent-identity`.
- A failed Action run leaves a Status wrong. Fixed in part: it fails visibly in the Actions tab,
  and `qa` reads the sub-issues.
- One token writes the org board. Waived until `agent-identity`; it is a secret, never printed.
- The private-data check is a pattern list and misses what it has no pattern for. Waived: a miss
  is one pattern added in `lib/feedback.ts`.
- Proof: one `bun test` through `runBin` with a recording fake `gh` per guard a live run cannot
  show without writing to the public repository, the model's eleven paths as the derivation's
  test table, and one live loop on `qsmark-labs/qsm-marketplace` with `test:` issues closed after.
