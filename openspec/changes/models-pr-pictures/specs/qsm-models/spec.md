## ADDED Requirements

### Requirement: subgraph finds what a change touches

`subgraph [--base <ref>] [--widen <id>...] --out <dir>` SHALL compare each graph of the branch with
the same graph at the merge base of the branch and `--base` (default `main`): the file under
`models/` in repo mode, the newest snapshot of each branch in local mode. The touched subgraph
SHALL be every element added, changed or removed, plus every element one flow or one relation away
in either version, plus each `--widen` element and its own one hop.

#### Scenario: A step added to the task loop

- **WHEN** a branch adds "Review the task again" between two steps of the build-task process
- **THEN** the touched BPMN subgraph holds the new step, its two flows and the two steps beside it,
  and nothing else of the process

### Requirement: subgraph draws a before and an after

For each graph whose touched subgraph is not empty, `subgraph` SHALL write `<kind>.before.svg` and
`<kind>.after.svg` into `--out`, `bpmn` or `c4`, both from one layout of the two versions together
so an element keeps its place, with the hints of the committed pictures. The after SHALL draw added
elements green, the before removed elements red, a changed element red in the before and green in
the after, and each picture a legend that says so.

#### Scenario: The agent widens the subgraph (path p-bd1af3)

- **WHEN** the change touches the C4 graph, the agent looks at the pictures, finds them not enough
  to understand and runs `subgraph --widen mp.tasks`
- **THEN** both C4 pictures are drawn again with qsm-tasks and its neighbours, and the PR opens with
  them

### Requirement: subgraph says when a change touches neither graph

When no graph is touched, `subgraph` SHALL write no picture, print that the change touches neither
graph, and exit `ok`.

#### Scenario: A change to a skill's wording (path p-1c4015)

- **WHEN** a change edits only a `SKILL.md` and `subgraph` finds both graphs equal to the base
- **THEN** it prints that the change touches neither graph, and the PR body says so in one line
