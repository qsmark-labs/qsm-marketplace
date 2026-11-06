## ADDED Requirements

### Requirement: Planning turns a feature request into a planned feature

The plan skill SHALL take a filed feature issue, settle what its answers leave
open through grilling, and have the spec tool write one feature change, models first, in the
session's worktree on `feature/<n>`. The plan SHALL open with a Feasibility section: what can be
done, what cannot and why, and an estimate against the request's budget. After the owner's yes it
SHALL commit the change, bind the issue, replace its body with a one-screen summary, and create no
task and no pull request.

#### Scenario: A filed feature is planned

- **WHEN** the owner asks to plan feature 3, filed through the feature request form
- **THEN** after the owner's yes the local branch `feature/3` holds the change in one commit,
  feature 3 carries its `change:` label and the one-screen summary, no pull request exists, and
  feature 3 has no sub-issue

#### Scenario: The plan opens with its feasibility

- **WHEN** the owner reads the plan of feature 3 before his yes
- **THEN** its first section is Feasibility, naming what can be done, what cannot and why, and the
  estimate against the budget the request named

### Requirement: A request too big for one feature is decoupled into new features

When the plan finds the request too big for one feature, it SHALL end in a proposed split, each
part named with the part of the request it carries. After the owner's yes the plan skill SHALL file
one new feature issue per part, each linking the original and each planned on its own, and close the
original with a comment that links every new issue. It SHALL create no task for the original.

#### Scenario: A request too big is decoupled

- **WHEN** the plan of feature 3 proposes two parts and the owner says yes to the split
- **THEN** two new feature issues exist, each holding its part of the request and a link to
  feature 3, and feature 3 is closed with a comment "Decoupled into #12, #13"

#### Scenario: The owner does not agree to the split

- **WHEN** the owner asks for changes to the proposed split
- **THEN** the plan is revised and read again, and no new issue is filed and feature 3 stays open

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

**Reason**: The flow is now the feature process of `feature_flow_process` of
`models/marketplace.bpmn`, from a form to the owner's merge of the feature pull request; there is no
epic and no per-task spec change.

**Migration**: "Planning turns a feature request into a planned feature" and "Splitting a feature
is a session with the owner" here, and the qsm-marketplace requirement "A feature moves from
request to main along one process".
