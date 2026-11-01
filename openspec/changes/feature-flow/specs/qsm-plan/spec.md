## ADDED Requirements

### Requirement: Planning turns a feature request into a planned feature

The plan skill SHALL take a feature issue filed through the form, settle what its six answers leave
open through grilling, and hand it to the spec tool to write one feature change, models first.
It SHALL then replace the issue body with a one-screen summary that shows the change's SVGs and
links the change, bind the change to the feature, and end with the owner's approval of the plan.
It SHALL create no task.

#### Scenario: A filed feature is planned

- **WHEN** the owner asks to plan feature 3, filed through the feature request form
- **THEN** a feature change exists with its models, specs and design, the issue body opens with
  the SVGs and links the change, and no sub-issue of 3 exists

#### Scenario: The owner does not approve the plan

- **WHEN** the owner asks for a revision of the plan, or drops it
- **THEN** the change is revised and shown again, or the feature is closed as not planned, and in
  neither case is a task created

### Requirement: Splitting a feature is a session with the owner

After the plan is approved, the plan skill SHALL split the feature with the owner into tasks, each
one concern whose pull request the owner can read in one sitting, created as sub-issues of the
feature in build order. Each task SHALL name the fakes it adds, each marked with the task that
replaces it, so every merge leaves `feature/<n>` running. The split SHALL push `feature/<n>` from
main and SHALL write no task list into the change.

#### Scenario: A feature is split

- **WHEN** the owner and the agent split feature 3 into three tasks, the second needing a part the
  third builds
- **THEN** three sub-issues of 3 exist ordered by blocked-by, the second names its fake and the
  third as the task that replaces it, and `feature/3` exists on the remote

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
