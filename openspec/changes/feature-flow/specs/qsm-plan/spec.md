## ADDED Requirements

### Requirement: Planning turns a feature request into a planned feature

The plan skill SHALL take a feature issue filed through the form, settle what its six answers leave
open through grilling, have the spec tool write one feature change, models first, in the session's
worktree on the local branch `feature/<n>`, and commit it there after the owner's yes in the
session. It SHALL bind the issue to the change, replace the issue body with a one-screen summary,
and create no task and no pull request.

#### Scenario: A filed feature is planned

- **WHEN** the owner asks to plan feature 3, filed through the feature request form
- **THEN** after the owner's yes the local branch `feature/3` holds the change in one commit,
  feature 3 carries its `change:` label and the one-screen summary, no pull request exists, and
  feature 3 has no sub-issue

### Requirement: Splitting a feature is a session with the owner

After the owner's yes to the plan, the plan skill SHALL split the feature with the owner into tasks,
each one concern whose pull request the owner can read in one sitting, created as sub-issues in
build order, and SHALL first push `feature/<n>`, which planning cut from main. Every fake a task
adds SHALL have a later task that replaces it, so no fake reaches main. The split SHALL write no
task list into the change.

#### Scenario: A feature is split

- **WHEN** the owner and the agent split feature 3 into three tasks, the second needing a part the
  third builds
- **THEN** three sub-issues of 3 exist ordered by blocked-by, the second names its fake and the
  third as the task that replaces it, `feature/3` exists on the remote, and feature 3 is In Dev

#### Scenario: A task too large to review

- **WHEN** a proposed task would touch several concerns the owner cannot read in one sitting
- **THEN** the plan skill splits it before creating it, and asks the owner where the cut goes

## REMOVED Requirements

### Requirement: The flow runs from business request to a closed epic

**Reason**: The flow is now the feature process of `models/flow.bpmn`, from a form to the owner's
merge of the feature pull request; there is no epic and no per-task spec change.

**Migration**: "Planning turns a feature request into a planned feature" and "Splitting a feature
is a session with the owner" here, and the qsm-marketplace requirement "A feature moves from
request to main along one process".
