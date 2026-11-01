## ADDED Requirements

### Requirement: A change is bound to its feature

A change and its feature SHALL be bound by the label `change:<change-id>` on the feature, written
and read through the task tool. spec-propose SHALL look the label up before it writes and, finding
no feature with it, bind the feature the change plans. It SHALL create no task. When the task tool
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

### Requirement: Archive runs on the feature branch and closes nothing

spec-archive SHALL archive a feature's change on `feature/<n>` after QA has shown every path, so the
feature pull request carries the code and the archived specs into main in one merge. It SHALL close
no issue, set no Status, and report what the feature waits for: open tasks, the QA agent, or the
owner's merge.

#### Scenario: QA passed

- **WHEN** QA has shown every path of feature 3 and spec-archive runs on `feature/3`
- **THEN** the change is archived in a commit on `feature/3`, feature 3 stays open, and the reply
  says it waits for the owner's merge of the feature pull request

#### Scenario: Tasks remain

- **WHEN** spec-archive is asked to run while a task of the feature is open
- **THEN** spec-archive SHALL name the open tasks and archive nothing

## REMOVED Requirements

### Requirement: A change has one task in the task tool, created with its spec

**Reason**: A change is bound to its feature, not to a task; tasks are created at the split and no
task list is written into the change.

**Migration**: "A change is bound to its feature".

### Requirement: An epic closes only when its close rule holds

**Reason**: The feature no longer closes at archive: it closes when the owner merges the feature
pull request into main, and there is no test-it task to check.

**Migration**: "Archive runs on the feature branch and closes nothing" and the qsm-tasks
requirement "Tasks close on merge into their feature branch, a feature on its merge into
main".
