## ADDED Requirements

### Requirement: A feature moves from request to main along one process

A feature SHALL move along the process `models/flow.bpmn`: request, planning and the owner's merge
of the change, the split onto `feature/<n>`, every task built (the called process
`models/build-task.bpmn`: build, review and the owner's merge into `feature/<n>`, then the branch
brought up to date with main), QA, and the feature pull request, whose merge into main by the owner
is the accept. Every cover path of both processes SHALL have a scenario here.

#### Scenario: One task, one review finding, no conflict, no QA finding (path p-8798e1)

- **WHEN** the review of the only task finds something, the agent fixes it, the owner merges, the
  update from main is clean and QA finds nothing
- **THEN** the branch is Ready For Test, and after QA passes the agent opens the feature pull
  request with the change archived, and the owner's merge closes the feature as Done

#### Scenario: A second task is built after the first merges (path p-bc080f)

- **WHEN** a task merges into `feature/<n>` and another task of the feature is still open
- **THEN** the merged task is closed, the next task is built, and the branch is brought up to date
  with main only after the last task closes

#### Scenario: Main moved and the update conflicts (path p-873b6c)

- **WHEN** the last task closes and bringing `feature/<n>` up to date with main conflicts
- **THEN** a conflict task is filed under the feature, an agent resolves it in a pull request that
  the review agent reviews first and the owner merges, and QA starts only after a clean update

#### Scenario: QA finds a contract bug (path p-981dbb)

- **WHEN** QA finds that a cover scenario of the feature does not hold
- **THEN** a fix task is filed under the feature, built and merged like any task, and QA runs again
  after the next clean update

### Requirement: A feature change uses the feature schema

The repository SHALL hold one OpenSpec schema `feature` in `openspec/schemas/feature/` with the
artifacts proposal, models, specs and design, in that order of dependency, and no tasks artifact.
Apply SHALL require the design and track no file. A feature's change SHALL name the schema in its
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
the budget. The feature request SHALL set the issue type Feature and the issue form the type Bug.

#### Scenario: The owner files a feature

- **WHEN** the owner opens a new issue and picks the feature request form
- **THEN** the issue cannot be submitted with a question empty, and it is created with the type
  Feature and one section per question

### Requirement: A pull request says before, after, what it solves and what it closes

The repository SHALL hold a pull request template with the sections Before, After, What it solves
and Closes. A task pull request SHALL target `feature/<n>` and close its task with `Closes #N`; a
feature pull request SHALL target main, describe the whole feature before and after, list the
scenarios QA ran, and close the feature with `Closes #<feature>`.

#### Scenario: A task pull request is opened

- **WHEN** an agent opens the pull request of task 12 of feature 3
- **THEN** its base is `feature/3`, its body has the four sections, and its last line is
  `Closes #12`
