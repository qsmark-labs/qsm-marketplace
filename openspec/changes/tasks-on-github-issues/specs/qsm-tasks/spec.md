## ADDED Requirements

### Requirement: A feature holds the intent and the change, its tasks are its pull requests

The `task-tool` skill SHALL state the model in GitHub's terms: a feature is an issue of type
`Feature` bound to its change by `change:<change-id>`; a task is a sub-issue of type `Task`,
created at the split. No task SHALL be created at planning, and no test-it task SHALL exist.

#### Scenario: A feature is planned, then split

- **WHEN** planning binds feature 3 to its change and the split adds three tasks
- **THEN** feature 3 carries `change:<change-id>`, its tasks carry none, no test-it task exists,
  and feature 3 is In Dev from its first task

#### Scenario: A fix

- **WHEN** the work is a fix
- **THEN** the agent creates neither a feature nor a task, and the commit message carries the why

### Requirement: A task closes when its pull request merges into the feature branch

The Action SHALL close a task when its pull request merges into `feature/<n>` with `Closes #<n>`;
`close --reason` SHALL close it when no pull request exists.

#### Scenario: A task without a pull request

- **WHEN** a task is done with no pull request and the agent runs `close 12 --reason "no change"`
- **THEN** task 12 is closed with the reason as a comment

### Requirement: Only the owner's merge closes a feature

Only the owner's merge of the feature pull request into main SHALL close a feature.

#### Scenario: The last task closes

- **WHEN** the last open sub-issue of a feature closes
- **THEN** the agent does not close the feature, and its reply says the feature waits for the
  update from main and then for QA

### Requirement: GitHub Issues is the task tool, reached through the qsm-tasks verbs only

The skill SHALL map each step to a `qsm-tasks` verb, SHALL tell the agent to use no raw `gh`, `jq`
or `gh api` for issues, to report a step with no verb as a gap, and to report a failed verb with
its cause and do nothing in its place. It SHALL copy no Status name or definition: the agent runs
`qsm-tasks flow`. It SHALL name `br` and `.beads` nowhere.

#### Scenario: A session starts

- **WHEN** a session starts and the agent loads the skill
- **THEN** it runs `qsm-tasks ready` and `qsm-tasks list --mine` first, and names the task it takes

#### Scenario: A verb fails

- **WHEN** a verb exits `failed` because the token lacks the `project` scope
- **THEN** the agent reports the cause and the fix the verb printed, and does not create the issue
  another way

### Requirement: Work not done now is deferred, and feedback is its own issue type

Real work that is not for now SHALL be deferred with `unclaim --until`, work that will not be done
closed with `close --not-planned` and a reason, and the title words searched with `list --search`
before an issue is created. Feedback SHALL be filed with `qsm-tasks feedback`, abstract, with no
suggested fix and no personal or system data; a subagent SHALL create no other issue.

#### Scenario: A subagent files feedback from another project

- **WHEN** a subagent runs `qsm-tasks feedback` in a checkout that is not the marketplace
- **THEN** the issue is filed in the marketplace repository with no path of the machine in it

### Requirement: The skill says who moves what

A task SHALL move by `claim`, the built-in workflow or `review` to Agent Review, `human` when CI is
green and every finding fixed, and the owner's merge. The QA agent SHALL take a feature from
`ready --qa` with `qa`, run the scenarios of its cover, file a finding with `add --feature <n>`, and
when nothing is found post `note <n>` whose first line is `QA passed`. Everything posted SHALL be in
the owner's name, naming no agent or AI.

#### Scenario: QA finds a defect

- **WHEN** a cover scenario of feature 3 does not hold
- **THEN** the QA agent runs `add --feature 3` with the defect as title, and the Action makes the
  feature Blocked

#### Scenario: QA finds nothing

- **WHEN** every cover scenario of feature 3 holds
- **THEN** the QA agent posts a note on 3 whose first line is `QA passed`, and feature 3 stays In
  Test until the owner merges the feature pull request

## REMOVED Requirements

### Requirement: Epics hold the intent of a piece of work, tasks hold one spec change

**Reason**: One name for one concept: the parent of tasks is GitHub's Feature.

**Migration**: "A feature holds the intent and the change, its tasks are its pull requests".

### Requirement: An epic closes only when the work is proven and pushed

**Reason**: A feature closes on the owner's merge of the feature pull request; there is no test-it.

**Migration**: "Only the owner's merge closes a feature".

### Requirement: One skill names br

**Reason**: The tool is GitHub Issues; the skill still owns every verb name.

**Migration**: "GitHub Issues is the task tool, reached through the qsm-tasks verbs only".
