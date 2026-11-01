## ADDED Requirements

### Requirement: A QA agent tests every path of a feature as a blackbox

A QA agent SHALL take a feature that waits for QA, run each path its models' cover lists against
`feature/<n>` deployed in a sandbox, without reading the code, and SHALL file one fix task under
the feature per path that does not hold, or report every path with its evidence when all hold.

#### Scenario: A path does not hold

- **WHEN** the QA agent runs a path of feature 3 and the result differs from the model
- **THEN** a fix task under feature 3 names the path id and what was seen, and the feature is
  Blocked
