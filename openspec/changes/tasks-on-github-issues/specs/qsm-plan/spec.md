## ADDED Requirements

### Requirement: Every feature has acceptance criteria that QA checks

The plan skill SHALL ensure a feature carries acceptance criteria written by grilling, each one a
thing a run can show, and SHALL NOT add a test-it task to the feature. When the feature is written
it SHALL be an issue of type `Feature` with Status Todo. After its tasks are done, the QA agent
tests the whole feature against the business request and those criteria on the real path, and the
owner's merge of the feature pull request into main closes it; the task tool's skill holds
that flow.

#### Scenario: A feature is split

- **WHEN** the plan skill splits a feature into tasks
- **THEN** the set SHALL contain only pieces of the work and no test-it task

#### Scenario: A feature has no acceptance criteria

- **WHEN** the plan skill is asked to split a feature whose description holds no acceptance
  criteria
- **THEN** it SHALL hand back to grilling and SHALL NOT split the feature

## REMOVED Requirements

### Requirement: Every epic has acceptance criteria and a test-it task

**Reason**: The feature's final proof is the QA test, not a task, so the criteria stay and the
test-it task goes.

**Migration**: "Every feature has acceptance criteria that QA checks".
