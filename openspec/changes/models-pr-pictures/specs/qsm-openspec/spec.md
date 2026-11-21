## ADDED Requirements

### Requirement: A pull request shows what its change does to the graphs

Before spec-apply opens a pull request, the agent SHALL run
`qsm-bpmn subgraph --out <change>/models` and `qsm-c4 subgraph --out <change>/models`, look at every
picture, widen the subgraph until the pictures explain the change, and commit the pictures. The pull
request body and one comment on the bound task SHALL link the before and the after of each touched
graph, or say in one line that the change touches neither.

#### Scenario: A change that touches the business process

- **WHEN** spec-apply opens the pull request of a change that adds a step to a process
- **THEN** its body links `bpmn.before.svg` and `bpmn.after.svg` from the change's `models/`, says
  the C4 graph is untouched, and the bound task carries the same links

### Requirement: A change's pictures are its subgraph before and after

The feature schema's models artifact SHALL be the pictures `qsm-bpmn subgraph` and
`qsm-c4 subgraph` write into the change's `models/`, so a proposal opens with the before and the
after of what it touches. A change that touches neither graph SHALL hold a `models/` with no
picture and a proposal that says so.

#### Scenario: The proposal of a new change

- **WHEN** spec-propose writes a change that renames a C4 container
- **THEN** the change's `models/` holds `c4.before.svg` and `c4.after.svg` and the proposal shows
  both as images before its summary
