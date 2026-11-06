## ADDED Requirements

### Requirement: A QA agent runs the cover scenarios of a feature as a blackbox

A QA agent SHALL take a feature at Ready For Test, run every spec scenario that cites a cover path
of the feature's BPMN against `feature/<n>` deployed in a sandbox, without reading the code, and
file one fix task under the feature per scenario that does not hold, or post a `QA passed` note
with each scenario's evidence when all hold.

#### Scenario: A scenario does not hold

- **WHEN** the QA agent runs a cover scenario of feature 3 and the result differs from the model
- **THEN** a fix task under feature 3 names the path id and what was seen, and the feature is
  Blocked

## MODIFIED Requirements

### Requirement: Dependencies

qsm-review SHALL declare `qsm-forge` and `qsm-models` in the `dependencies` array of its
plugin.json and SHALL declare nothing else.

- `qsm-forge`: `workflow-review` reads and posts a review through `qsm-forge gh` and `qsm-forge gl`.
- `qsm-models`: the QA agent reads the cover of a feature's BPMN through `qsm-models paths`.

#### Scenario: Installing the plugin

- **WHEN** the plugin is installed
- **THEN** `claude plugin install` installs `qsm-forge` and `qsm-models` with it

#### Scenario: qsm-forge is not installed

- **WHEN** `workflow-review` runs and the `qsm-forge` binary is not on PATH
- **THEN** the skill SHALL report `missing`, name `qsm-forge`, and tell the caller to install it,
  and SHALL NOT attempt the review
