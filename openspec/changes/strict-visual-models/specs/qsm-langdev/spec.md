## ADDED Requirements

### Requirement: Models are checked like any other source at a commit

The checker registry SHALL run `qsm-models lint`, `qsm-models render --check` and
`qsm-models check` on a staged `.bpmn` or `.c4` file, the way it runs a linter on any staged
language. A missing `qsm-models` binary SHALL fail as every missing checker does, never a skip.

#### Scenario: A stale SVG at a commit

- **WHEN** a commit stages an edited `models/marketplace.bpmn` and not its pictures
- **THEN** the pre-commit gate fails naming each stale SVG and the commit does not happen

#### Scenario: The model tool is not installed

- **WHEN** a commit stages a `.bpmn` file and `qsm-models` is not on PATH
- **THEN** the gate fails naming `qsm-models` as missing

### Requirement: Dependencies

qsm-langdev SHALL declare `qsm-models` in the `dependencies` array of its plugin.json, and SHALL
have no fallback for it.

- `qsm-models`: the commit gate runs its binary on a staged model.

#### Scenario: The plugin is installed

- **WHEN** the plugin is installed
- **THEN** `claude plugin install` installs `qsm-models` with it
