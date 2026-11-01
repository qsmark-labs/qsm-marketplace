## ADDED Requirements

### Requirement: The git rule names the feature flow's branches

The git rule activated by qsm-setup SHALL say that a task's work lands by a pull request into
`feature/<n>`, opened by the main session that built it, and a feature's work lands in main only by
the owner's merge of the feature pull request. It SHALL keep that a worker never pushes, merges or
opens a pull request.

#### Scenario: The rule is read before a push

- **WHEN** a main session finishes a task of feature 3 and reads the git rule
- **THEN** the rule tells it to push the task branch and open a pull request into `feature/3`, and
  never to merge into main
