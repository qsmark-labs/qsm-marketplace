## ADDED Requirements

### Requirement: subgraph finds what a change touches in the C4 graph

`qsm-c4 subgraph [--base <ref>] [--widen <id>...] --out <dir>` SHALL compare the C4 graph of the
branch with the same graph at the merge base of the branch and `--base` (default `main`), the file
under `models/` at each, diffed by qsm-c4 itself by element id and relation. The touched subgraph
SHALL be every element added, changed or removed, plus every element one relation away in either
version, plus each `--widen` element and its own one hop.

#### Scenario: A relation added between two containers

- **WHEN** a branch adds a relation from qsm-plan to qsm-tasks
- **THEN** the touched C4 subgraph holds the relation, both containers, the elements one relation
  away from either, and the boundary they sit in

### Requirement: subgraph draws a C4 before and after

When the touched subgraph is not empty, `subgraph` SHALL write `c4.before.svg` and `c4.after.svg`
into `--out`, both from one layout of the two versions together so an element keeps its place, with
the hints of the committed pictures. The after SHALL draw added elements green, the before removed
elements red, a changed element red in the before and green in the after, and each picture a legend
that says so.

#### Scenario: The agent widens the subgraph (path p-bd1af3)

- **WHEN** the change touches the C4 graph, the agent looks at the pictures, finds them not enough
  to understand and runs `qsm-c4 subgraph --widen mp.tasks`
- **THEN** both C4 pictures are drawn again with qsm-tasks and its neighbours, and the PR opens with
  them

### Requirement: subgraph says when a change does not touch the C4 graph

When the C4 graph is not touched, `subgraph` SHALL write no picture, print that the change does not
touch the C4 graph, and exit `ok`.

#### Scenario: A change to a skill's wording

- **WHEN** a change edits only a `SKILL.md` and `qsm-c4 subgraph` finds the C4 graph equal to the
  base
- **THEN** it prints that the change does not touch the C4 graph and writes no picture
