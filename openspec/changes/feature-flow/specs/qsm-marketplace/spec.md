## ADDED Requirements

### Requirement: A feature moves from request to main along one process

A feature SHALL move along the process `models/flow.bpmn` of this change: request, planning, split,
then per task build, review and the owner's merge into `feature/<n>`, then the branch brought up to
date with main, QA, and the feature pull request whose merge into main by the owner is the accept.
Every path of the process's cover SHALL be a scenario QA runs when it tests this feature.

#### Scenario: The straight way, after one revision of the plan (path p-8292f0)

- **WHEN** the owner asks for one revision of the plan, approves it, the review of the one task
  finds something that is fixed, and QA finds nothing
- **THEN** the owner merges the feature pull request into main and the feature is closed as Done

#### Scenario: The owner drops the feature at planning (path p-ccd9ed)

- **WHEN** the owner does not approve the plan and drops it
- **THEN** the feature is closed as not planned and no branch or task remains open

#### Scenario: The owner asks for changes on a task pull request (path p-7b4410)

- **WHEN** the owner reads a task pull request and requests changes
- **THEN** the agent fixes them, the review agent reviews again, and only the owner's merge closes
  the task

#### Scenario: A second task is built after the first merges (path p-acb308)

- **WHEN** a task merges into `feature/<n>` and another task of the feature is still open
- **THEN** the merged task is closed, the next task is built, and the feature waits for QA only
  after the last task closes

#### Scenario: Main moved and the update conflicts (path p-2f3b69)

- **WHEN** the last task closes and bringing `feature/<n>` up to date with main conflicts
- **THEN** the conflict is resolved in a pull request that the review agent reviews and the owner
  merges before QA starts

#### Scenario: QA finds a contract bug (path p-eb69f2)

- **WHEN** QA finds that a path of the feature does not hold
- **THEN** a fix task is filed under the feature, built and merged like any task, and QA runs again

#### Scenario: The owner rejects the feature pull request (path p-328378)

- **WHEN** the owner reads the feature pull request and does not accept it
- **THEN** the rejection is filed as a fix task under the feature and the feature returns to the
  task loop

### Requirement: A feature change uses the feature schema

The repository SHALL hold one OpenSpec schema `feature` in `openspec/schemas/feature/` with the
artifacts proposal, models, specs and design, in that order of dependency, and no tasks artifact.
Apply SHALL require the design and track no file. A change of a feature SHALL name it in its
`.openspec.yaml`.

#### Scenario: A new feature change

- **WHEN** a change is created with `schema: feature` and only its proposal is written
- **THEN** `openspec status` shows models ready, specs and design blocked, and no tasks artifact

#### Scenario: A feature change with no tasks file validates

- **WHEN** a feature change has proposal, models, specs and design and no tasks.md
- **THEN** `openspec validate <id> --strict` passes

### Requirement: Issue forms ask the six questions

The repository SHALL offer two issue forms, a feature request and an issue, and no blank issue.
Each form SHALL have one required field per question of the implementation rule's "First: why":
who it is for, the problem and why now, what is not done, what exists, what proves it works, and
the budget. The feature request SHALL make an issue of type Feature and the issue form one of
type Bug.

#### Scenario: The owner files a feature

- **WHEN** the owner opens a new issue and picks the feature request form
- **THEN** the issue cannot be submitted with a question empty, and it is created with the type
  Feature and one section per question

### Requirement: A pull request says before, after, what it solves and what it closes

The repository SHALL hold a pull request template with the sections Before, After, What it solves
and Closes. A task pull request SHALL target `feature/<n>` and close its task with `Closes #N`; a
feature pull request SHALL target main, describe the whole feature before and after, list the
paths QA ran, and close the feature with `Closes #<feature>`.

#### Scenario: A task pull request is opened

- **WHEN** an agent opens the pull request of task 12 of feature 3
- **THEN** its base is `feature/3`, its body has the four sections, and its last line is
  `Closes #12`

### Requirement: No fake reaches main

A fake that lets part of a feature run before its neighbour exists SHALL carry the marker
`qsm-fake: #<task>` naming the task that replaces it. A check on every pull request into main
SHALL fail, naming each file and line, while a marker is left in the tree.

#### Scenario: A fake is left at the feature pull request

- **WHEN** the feature pull request into main is opened and a file still holds `qsm-fake: #14`
- **THEN** the check fails naming the file, the line and task 14, and the pull request cannot merge
