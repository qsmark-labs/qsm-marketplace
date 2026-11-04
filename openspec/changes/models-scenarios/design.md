## Context

The structure is the Scenario link component of qsm-models in
`../feature-flow/models/marketplace.c4`; the behaviour is `models/qsm-models/cover-path.bpmn`. The
tag is one of the four links of `strict-visual-models`, checked there; the page is the BPMN page of
`models-pages`.

## Decisions

1. **The report is a snapshot of a kind `cucumber`** (open for the owner). Options: A, a kind
   `cucumber` in the store; B, the BPMN converter reads the report file from the checkout the server
   runs in; doing nothing. Recommended: A. Reason: the page reads only the store, so another
   project's results show too and an earlier run is kept; B makes a snapshot's JSON depend on the
   working tree and shows nothing for another project. Cost of A: one more kind than the epic names.
   Reopens when: the owner picks B.
2. **The tag is the only link from a scenario to a path.** Options: a tag on the scenario, a
   `qsm:scenario` attribute on the task. Choice: the tag. Reason: the scenario is the developer's
   and moves with the code; one link, one place, and the gate of `strict-visual-models` checks it.
3. **feats' Cucumber JSON, not its JUnit.** feats has three reporters, `pretty`, `junit` and
   `cucumber-json` (`feats/src/reporting/from-env.ts`); only the Cucumber JSON carries tags.
4. **A result is per scenario, the worst step decides.** A failed step fails the scenario, a
   skipped or pending step without a failed one is not run.

## Critiques

The three critique passes are in the proposal, under `## Critiques`.
