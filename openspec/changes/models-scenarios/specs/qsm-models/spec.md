## ADDED Requirements

### Requirement: A scenario names its cover path by a tag

A Gherkin scenario SHALL link to a cover path by the tag `@p-<id>`, the path's id, and MAY carry
several. The scenarios SHALL live in the project's `.feature` files, kept by its developers.

#### Scenario: One scenario, two paths

- **WHEN** a scenario in `features/models.feature` is tagged `@p-c42c4d @p-1f20e0`
- **THEN** both paths list it on the BPMN page once a report holds it

### Requirement: The Cucumber JSON report is a snapshot of kind cucumber

The installer SHALL install the kind `cucumber` with the other kinds. Its converter SHALL read a
Cucumber JSON report as feats writes it with `FEATS_REPORTERS=cucumber-json:<file>`, and print each
scenario's name, file, tags and result: passed when every step passed, failed when any step
failed, and not run otherwise. A file that is not a Cucumber JSON report SHALL fail `failed`.

#### Scenario: The agent stores a run (path p-1f20e0)

- **WHEN** every cover path is tagged, the agent runs the scenarios with the Cucumber JSON reporter
  and creates a `cucumber` snapshot of the report, and every scenario passed
- **THEN** the owner reads every path of the process as passed, and the process is proven

### Requirement: The BPMN page shows each path's result

The BPMN page SHALL list the cover paths of the process it shows, and for each the scenarios of the
newest `cucumber` snapshot of the branch that carry its tag, with their result and the report's
time. A path no scenario carries SHALL show as uncovered. Choosing a path SHALL highlight its flows.

#### Scenario: A path with no scenario, then a failing one (path p-c42c4d)

- **WHEN** a path has no tagged scenario, the agent writes one tagged with its id, runs the
  scenarios and stores the report, and the scenario fails
- **THEN** the page first shows the path as uncovered, then with the scenario failed, and the owner
  asks for a fix of that path

#### Scenario: No report yet

- **WHEN** the branch has no `cucumber` snapshot
- **THEN** the page shows every path as uncovered and says no report is stored
