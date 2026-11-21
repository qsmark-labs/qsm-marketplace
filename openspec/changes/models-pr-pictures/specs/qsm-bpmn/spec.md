## ADDED Requirements

### Requirement: subgraph finds what a change touches in the BPMN graph

`qsm-bpmn subgraph [--base <ref>] [--widen <id>...] --out <dir>` SHALL compare the BPMN graph of the
branch with the same graph at the merge base of the branch and `--base` (default `main`), the file
under `models/` at each. The touched subgraph SHALL be every element added, changed or removed, plus
every element one flow away in either version, plus each `--widen` element and its own one hop.

#### Scenario: A step added to the task loop

- **WHEN** a branch adds "Review the task again" between two steps of the build-task process
- **THEN** the touched BPMN subgraph holds the new step, its two flows and the two steps beside it,
  and nothing else of the process

### Requirement: subgraph draws a BPMN before and after

When the touched subgraph is not empty, `subgraph` SHALL write `bpmn.before.svg` and
`bpmn.after.svg` into `--out`, both from one layout of the two versions together so an element keeps
its place. The after SHALL draw added elements green, the before removed elements red, a changed
element red in the before and green in the after, and each picture a legend that says so.

#### Scenario: Both pictures of a touched process

- **WHEN** the branch of the step added to the task loop runs `qsm-bpmn subgraph --out <dir>`
- **THEN** `bpmn.before.svg` and `bpmn.after.svg` exist, the new step is green in the after, and
  the two steps beside it stand in the same place in both

### Requirement: subgraph says when a change does not touch the BPMN graph

When the BPMN graph is not touched, `subgraph` SHALL write no picture, print that the change does
not touch the BPMN graph, and exit `ok`.

#### Scenario: A change to a skill's wording (path p-1c4015)

- **WHEN** a change edits only a `SKILL.md` and `qsm-bpmn subgraph` finds the BPMN graph equal to
  the base
- **THEN** it prints that the change does not touch the BPMN graph, and the PR body says the change
  touches neither graph in one line
