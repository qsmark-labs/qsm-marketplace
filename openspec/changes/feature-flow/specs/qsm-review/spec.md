## ADDED Requirements

### Requirement: A task pull request is reviewed against its feature's change

When a pull request targets `feature/<n>`, the workflow review SHALL read the feature's change
(proposal, models, specs and design) as what was asked, and SHALL report a finding when the code
contradicts a requirement, a scenario, or the C4 model of what it touches.

#### Scenario: The code adds a dependency the model does not have

- **WHEN** a task pull request into `feature/3` makes one plugin call another and the feature's C4
  model has no relation between them
- **THEN** the review posts a finding that names the relation and the model file
