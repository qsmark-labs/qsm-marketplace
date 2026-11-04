## ADDED Requirements

### Requirement: A change edits the project's one graph

A feature's change SHALL hold no model source. spec-propose SHALL have the agent edit the
project's graphs under `models/` on the change's branch, in local mode through the qsm-docs store,
and the change's `models/` SHALL hold only pictures of the processes and views it touches.
spec-archive SHALL move no model, because the graph already holds the change.

#### Scenario: A change adds a step to the task loop

- **WHEN** spec-propose writes a change that adds a review round to the build-task process
- **THEN** the change's branch edits `models/marketplace.bpmn`, the change's `models/` holds the
  picture of the build-task process, and `qsm-models check` finds no model file in the change

#### Scenario: The change is archived

- **WHEN** spec-archive archives that change
- **THEN** `models/marketplace.bpmn` is unchanged by the archive, and the change's pictures go to
  the archive with it
