## ADDED Requirements

### Requirement: A change is bound to its feature

A change and its feature SHALL be bound by the label `change:<change-id>` on the feature, written
and read through the task tool. spec-propose SHALL look the label up before it writes and, finding
no feature with it, bind the filed feature with `edit <n> --spec <change-id>`. It SHALL create no
task. When the task tool
is not reachable (no GitHub remote, no login, no board), spec-propose SHALL stop before writing and
name the cause. The skills SHALL say "the task tool" and never name a binary.

#### Scenario: The feature already carries the label

- **WHEN** a feature labelled `change:<change-id>` exists when spec-propose runs
- **THEN** spec-propose SHALL write the change for that feature and SHALL NOT bind a second one

#### Scenario: No feature carries the label

- **WHEN** no feature carries `change:<change-id>` when spec-propose runs for feature 3
- **THEN** spec-propose SHALL label feature 3 with it once the change is written, and SHALL create
  no task

#### Scenario: The task tool is not reachable

- **WHEN** the repository has no GitHub remote, the person is not logged in or no board is linked
- **THEN** spec-propose SHALL stop, name the cause, and SHALL NOT write the change

### Requirement: Archive runs on the feature branch at step 9 and closes nothing

Step 9 follows `land.bpmn` of the feature-flow change: once the feature is In Test with no open
sub-issue and its latest comment from QA starts with `QA passed`, the agent opens the feature pull
request to main and the owner reads it. spec-archive SHALL run on `feature/<n>` only after the
owner accepts that pull request, and archive the change there. It SHALL close no issue and set no
Status: the owner's merge of the feature pull request closes the feature.

#### Scenario: The owner accepts the feature pull request

- **WHEN** feature 3's pull request to main is open and the owner accepts it
- **THEN** the change is archived in a commit on `feature/3` and feature 3 stays open until the
  owner merges

#### Scenario: The owner has not accepted yet

- **WHEN** spec-archive is asked to run on a feature whose pull request to main the owner has not
  accepted, or that has no `QA passed` note
- **THEN** it archives nothing and names what the feature waits for: the QA agent or the owner

## REMOVED Requirements

### Requirement: A change has one task in the task tool, created with its spec

**Reason**: A change is bound to its feature, not to a task; tasks are created at the split and no
task list is written into the change.

**Migration**: "A change is bound to its feature".

### Requirement: An epic closes only when its close rule holds

**Reason**: The feature no longer closes at archive: it closes when the owner merges the feature
pull request into main, and there is no test-it task to check.

**Migration**: "Archive runs on the feature branch at step 9 and closes nothing" and the qsm-tasks
requirement "A feature holds the intent and the change, its tasks are its pull requests".
