## ADDED Requirements

### Requirement: Models are checked like any other source at a commit

The checker registry SHALL run `qsm-models lint` and `qsm-models render --check` on staged `.bpmn`
files and C4 sources, the way it runs a linter on any staged language. A missing `qsm-models`
binary SHALL fail as every missing checker does, never a skip.

#### Scenario: A stale SVG at a commit

- **WHEN** a commit stages an edited `flow.bpmn` and not its `flow.svg`
- **THEN** the pre-commit gate fails naming `flow.svg` as stale and the commit does not happen

#### Scenario: The model tool is not installed

- **WHEN** a commit stages a `.bpmn` file and `qsm-models` is not on PATH
- **THEN** the gate fails naming `qsm-models` as missing
