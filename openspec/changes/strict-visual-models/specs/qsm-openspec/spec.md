## ADDED Requirements

### Requirement: Archive moves a change's models to their owners

When spec-archive archives a feature's change, it SHALL move each BPMN file by its directory, a
`models/<plugin>/<f>.bpmn` into `plugins/<plugin>/models/` and a top-level `models/<f>.bpmn` into
the root `models/`, with its picture; and merge each C4 element by id, persons, systems and
containers into the root marketplace model, components into the model of the plugin their
container's path names. It SHALL then lint and render the owners' models and stop on a finding.

#### Scenario: A plugin's process and a component are archived

- **WHEN** a change holds `models/qsm-tasks/feature-status.bpmn` and a C4 component of the
  container `qsm-tasks`
- **THEN** after the archive the BPMN and its picture are in `plugins/qsm-tasks/models/`, the
  component is in the qsm-tasks model, and `qsm-models lint` and `render --check` pass on both
