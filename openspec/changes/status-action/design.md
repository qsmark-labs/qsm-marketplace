## Context

Moved from `qsm-tasks-cli` when #12 was decoupled; planned on its own as #15, after #13 and #14.
The behaviour is the spec and `feature_status_process` of `models/marketplace.bpmn`.

## Decisions

1. **A feature's Status is derived, and the Action is its only writer after planning.** The verb
   writes are `plan` and `qa`; everything else is the rule of the model, run on `issues: opened,
   closed, reopened` of a sub-issue, so the split's first task makes the feature In Dev as agreed.
   `qa` needs Ready For Test, which only the Action sets after a clean update from main.
   `edit --feature` moves an issue without an event, so both parents may lag until their next
   child event.
2. **The Action brings `feature/<n>` up to date with main** when the last task closes (agreed
   step 7). A conflict becomes a task under the feature, `Resolve the conflict of feature/<n> with
   main`, so it goes through the same build, review and merge as any task, the review agent first;
   its merge closes the last task again and the update runs again. The task is the Action's only
   post: it is how an agent learns of the conflict.
3. **The Action also closes what a merge into `feature/*` names.** GitHub closes `Closes #N` only
   on the default branch. On `pull_request: closed` with `merged` and a base `feature/*`, the
   Action closes each issue the body names as completed; "Item closed" then sets Done. One file,
   `.github/workflows/qsm-tasks.yml`, two jobs.
4. **The Action writes as the owner**, with the owner's token stored as a repository secret:
   `qsmark-bot` only opens pull requests (#14), and the owner said of the Action "ma to byt pode
   mnou".

## Unmeasured, measured before the code

1. Does an Action on `issues: opened` see the parent of an issue made with `add --feature`? If not,
   decision 1 is revised before the Action is built, with no silent second route.
2. Does the owner's token let the Action close the issues a merge into `feature/*` names, and
   bring main into `feature/<n>`, which the `feature` ruleset lets change only through a pull
   request?

## Critiques

- A failed Action run leaves a Status wrong. Fixed in part: it fails visibly in the Actions tab,
  and `qa` reads the sub-issues.
- Proof: the model's eleven paths as the derivation's test table, and one live loop on
  `qsmark-labs/qsm-marketplace` with `test:` issues closed after.
