## ADDED Requirements

### Requirement: Models are checked like any other source at a commit

The checker registry SHALL run `qsm-models lint` and `qsm-models render --check` on a staged `.bpmn`
or `.c4` file, and `qsm-models check` on a staged `.bpmn`, `.c4` or `.feature` file, because a
scenario's tag is a link, the way it runs a linter on any staged language. A missing `qsm-models`
binary SHALL fail as every missing checker does, never a skip.

#### Scenario: A stale SVG at a commit

- **WHEN** a commit stages an edited `models/marketplace.bpmn` and not its pictures
- **THEN** the pre-commit gate fails naming each stale SVG and the commit does not happen

#### Scenario: A scenario tag points nowhere

- **WHEN** a commit stages a `.feature` file whose scenario is tagged `@p-000000`
- **THEN** the pre-commit gate fails naming the tag and the file

#### Scenario: The model tool is not installed

- **WHEN** a commit stages a `.bpmn` file and `qsm-models` is not on PATH
- **THEN** the gate fails naming `qsm-models` as missing
