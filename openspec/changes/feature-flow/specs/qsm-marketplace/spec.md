## ADDED Requirements

### Requirement: A feature moves from request to main along one process

A feature SHALL move along `feature_flow_process` of `models/marketplace.bpmn`, the agreed steps 1
to 9: request, planning, the split, every open task built, main merged into `feature/<n>`, QA, and
landing on main. An activity SHALL carry its step number, and N.k when step N has several activities
in one diagram. A step of several actions SHALL be a call activity with its own diagram. Every cover
path of every diagram SHALL have a scenario here.

#### Scenario: Main moved and the update conflicts (path p-b4b42a)

- **WHEN** every open task is built and merging main into `feature/<n>` conflicts
- **THEN** a conflict task is filed under the feature and built like any task, main is merged
  again, and QA starts only after a clean merge

#### Scenario: QA finds a contract bug, then passes (path p-c73391)

- **WHEN** QA finds that a cover scenario of the feature does not hold
- **THEN** a fix task is filed per finding and built like any task; after the next clean merge of
  main QA runs again, passes, and the feature lands on main

#### Scenario: The owner drops the plan (path p-fbd761)

- **WHEN** the owner answers "Plan approved?" with no
- **THEN** the feature ends as not planned and no branch reaches GitHub

#### Scenario: The plan ends in a split (path p-614e67)

- **WHEN** the owner answers "Plan approved?" with split
- **THEN** the feature ends closed as decoupled, linking the new feature issues, and no branch
  reaches GitHub

#### Scenario: The owner asks for changes on the feature PR (path p-52253d)

- **WHEN** QA passed and the owner does not accept the feature pull request
- **THEN** the changes asked become fix tasks, built like any task, then main is merged, QA runs,
  and the owner reads the feature pull request again

### Requirement: Planning ends in the owner's yes

Step 2 SHALL follow `plan_process` of `models/marketplace.bpmn`: the agent gathers the context,
writes the intent and the feasibility, asks the open questions, draws the models and writes the
specs; the owner reads the plan. The change is committed on the local branch `feature/<n>` only
after the owner's yes (`record_plan_process`). Answering split, the owner has the agent file the new
feature issues and close the original with links (`decouple_process`). No pull request is opened.

#### Scenario: The owner asks for changes, then approves (path p-72bc2c)

- **WHEN** the owner reads the plan and asks for changes
- **THEN** the agent asks the open questions again and revises; after the owner's yes the change is
  committed onto `feature/<n>` and the feature issue is updated

#### Scenario: The approved plan is recorded (path p-f77c56)

- **WHEN** the owner says yes to the plan
- **THEN** the agent commits the change onto `feature/<n>`, then updates the feature issue

#### Scenario: The owner drops the feature (path p-3ddc2c)

- **WHEN** the owner reads the plan and drops it
- **THEN** the agent closes the feature as not planned and nothing is committed

#### Scenario: The owner splits the feature (path p-a65734)

- **WHEN** the owner reads a plan that proposes a split and answers split
- **THEN** the agent decouples the feature and nothing is committed onto `feature/<n>`

#### Scenario: The feature is decoupled into new features (path p-ab5c6d)

- **WHEN** the agent decouples a feature after the owner's split
- **THEN** it files one new feature issue per part, each linking the original, then closes the
  original with a comment linking every new issue, so the feature ends closed as decoupled

### Requirement: The split pushes the branch and files the tasks

Step 3 SHALL follow `split_process` of `models/marketplace.bpmn`: the agent pushes `feature/<n>`,
cuts the feature into tasks a person can review, with fakes and mocks so each task leaves working
code, and files them under the feature once the owner agrees.

#### Scenario: The owner asks for a different cut (path p-dd7cc5)

- **WHEN** the owner reads the task list and does not agree
- **THEN** the agent cuts again, and files the tasks only after the owner agrees

### Requirement: Every open task is built, reviewed and merged

Steps 4 to 8 SHALL follow `build_task_process` of `models/marketplace.bpmn` once per open task,
step 4 `consume_task_process` and step 7 `human_review_process`: the agent builds and opens the pull
request, the review agent and the CI clear it, the owner reads it and either merges it or asks for
changes, and the owner merges it himself only when he wants none.

#### Scenario: One review finding (path p-d3b89c)

- **WHEN** the review agent finds something in the task pull request
- **THEN** the agent fixes it and replies in the thread, the review runs again and finds nothing,
  the CI is green, and the owner reads the pull request and merges it

#### Scenario: The CI is red (path p-f9f802)

- **WHEN** the review agent finds nothing and the CI is not green
- **THEN** the agent fixes what the CI found and replies, the review agent reviews again, and only
  then does the owner read the pull request and merge it

#### Scenario: The owner wants changes (path p-258cd7)

- **WHEN** the review agent approves, the CI is green and the owner wants changes
- **THEN** he reviews it in step 7, the pull request returns to the review agent, and he reads it
  again after the second approval with a green CI before any merge

#### Scenario: Nothing found and the owner wants no changes (path p-3b1044)

- **WHEN** the review agent finds nothing, the CI is green and the owner wants no changes
- **THEN** the owner merges the pull request into `feature/<n>` and the task is closed

#### Scenario: The owner asks for a big change (path p-52aae0)

- **WHEN** the owner does not accept the pull request and the change he asks for is big
- **THEN** the agent fixes his comments, simplifies the change and reviews it itself, pushes and
  replies, and the owner reviews again

#### Scenario: The owner asks for a small change (path p-a9880f)

- **WHEN** the owner does not accept the pull request and the change he asks for is small
- **THEN** the agent fixes his comments, pushes and replies without the simplify pass, and the owner
  reviews again

#### Scenario: The owner accepts at once (path p-d7c6a6)

- **WHEN** the owner reviews the pull request and says it is good
- **THEN** the loop ends and the pull request returns to the Agent Review step

#### Scenario: The task becomes a pull request (path p-ef7dfb)

- **WHEN** an agent consumes an open task
- **THEN** it claims the task, and the pull request it opens targets `feature/<n>` only after the
  simplify pass and its own review

### Requirement: The owner lands the feature on main

Step 9 SHALL follow `land_process` of `models/marketplace.bpmn`: the agent opens the feature pull
request, the owner reads it, and only after the owner accepts does the agent archive the change and
the owner merge.

#### Scenario: The owner accepts (path p-de66ab)

- **WHEN** the owner accepts the feature pull request
- **THEN** the agent archives the change in a commit on `feature/<n>`, and the owner's merge into
  main closes the feature

#### Scenario: The owner asks for changes (path p-530307)

- **WHEN** the owner does not accept the feature pull request
- **THEN** the agent files a fix task per change asked and the change is not archived

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

### Requirement: Issue forms ask the five questions

The repository SHALL offer two issue forms, a feature request and an issue, the feedback template of
qsm-tasks, and no blank issue. Each of the two forms SHALL have one required field per question of
the implementation rule's "First: why": who it is for, the problem and why now, what is not done,
what exists, and what proves it works. The feature request SHALL set the issue type
Feature and the issue form the type Bug.

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

### Requirement: A pull request is small enough to review in one sitting

The check `pr-size` SHALL fail a pull request whose changed lines, added plus deleted, pass 400,
counting no file the base's `.gitattributes` marks `linguist-generated`, and SHALL name the count
and the limit. Main and `feature/*` SHALL require it.

#### Scenario: A task too big to review

- **WHEN** a task pull request changes 520 lines outside generated files
- **THEN** `pr-size` fails naming 520 changed lines and the limit 400, and the pull request cannot
  merge

#### Scenario: A model change is read through its picture

- **WHEN** a pull request changes 1000 lines of `models/marketplace.bpmn`, its pictures, and 60
  lines of specs
- **THEN** `pr-size` counts 60 and passes
