## ADDED Requirements

### Requirement: A feature holds the intent and the change, its tasks are its pull requests

The `task-tool` skill SHALL state the model in GitHub's terms. A feature SHALL be an issue of type
`Feature` holding the intent, bound to its change by the label `change:<change-id>`. A task SHALL be
an issue of type `Task`, a sub-issue of the feature, created when the feature is split and closed by
its pull request. No task SHALL be created at planning, no task list SHALL be written into a change,
and no test-it task SHALL exist. A follow-up, a side finding and feedback SHALL each be an issue.

#### Scenario: A feature is planned

- **WHEN** the planning session writes the change of feature 3
- **THEN** feature 3 carries `change:<change-id>` and has no sub-issue yet

#### Scenario: A feature is split into tasks

- **WHEN** the owner and the agent split feature 3
- **THEN** its tasks are sub-issues of type Task with no `change:` label, none is a test-it task,
  and the feature's Status is Todo until its first task is claimed

#### Scenario: A change is looked up before it is bound

- **WHEN** spec-propose runs `qsm-tasks list --spec add-x` and a feature labelled
  `change:add-x-more` exists
- **THEN** only a feature labelled `change:add-x` is the change's feature, and the binding is
  written only when `list --spec` printed none

#### Scenario: A fix

- **WHEN** the work is a fix
- **THEN** the agent creates neither a feature nor a task, and the commit message carries the why

#### Scenario: A finding that is not the ask

- **WHEN** the agent finds work while doing another task
- **THEN** it creates an issue that names the task it was working on as where it was discovered

### Requirement: GitHub Issues is the main task tool, reached through the qsm-tasks verbs

The `task-tool` skill SHALL state that GitHub Issues is the main task tool and SHALL map each step
of working with tasks to a verb or flag of the `qsm-tasks` binary: the ready list, a feature, a task
under a feature, an order between tasks, a claim, a comment, a close, a Status move, the feature
check, a deferral and a feedback issue. The skill SHALL tell the agent to create, nest, order,
comment, close and move issues only through those verbs, never through raw `gh`, `jq` or `gh api`
calls, and when a step has no verb to report the gap instead of composing a call. A verb that fails
SHALL be reported with its cause and nothing else done in its place. The skill SHALL name the `br`
tracker and the `.beads` store nowhere.

#### Scenario: A session starts

- **WHEN** a session starts and the agent loads the skill
- **THEN** the first steps it runs are `qsm-tasks ready` and `qsm-tasks list --mine`, and the reply
  names the count and the task it takes

#### Scenario: A verb fails

- **WHEN** a verb exits `failed` because the token lacks the `project` scope
- **THEN** the agent reports the cause and the fix the verb printed, and does not create the issue
  another way

#### Scenario: A step has no verb

- **WHEN** a step of the flow has no `qsm-tasks` verb
- **THEN** the agent says so and does not compose a `gh` call

#### Scenario: A file names the old tracker

- **WHEN** a review finds `br`, `beads` or `.beads` named in a skill, an agent, an instruction file
  or a plugin's code
- **THEN** the mention is removed or replaced with "the task tool" and a pointer to the `task-tool`
  skill

### Requirement: Work not done now is deferred or filed, and feedback is its own issue type

A task whose work is real but not now SHALL be deferred with `qsm-tasks unclaim --until`, never
closed silently and never left open in the ready list, and SHALL come back with `qsm-tasks unclaim`;
work that will not be done SHALL be closed with `qsm-tasks close --not-planned` and a reason. Before
creating an issue the agent SHALL search the title words with `qsm-tasks list --search` and comment
on an existing one instead. Feedback about the marketplace SHALL be filed with `qsm-tasks feedback
--area --kind --from`, which files an issue of the type `Feedback` in the marketplace repository,
never by an issue number, with a title that names the plugin or `marketplace`. The body SHALL be
abstract: the steps that led to it and how it should behave, with no suggested fix and no personal
or system data. A task filed from a feedback issue SHALL start its body with `From #<feedback>`,
which GitHub shows as a back-reference on the feedback issue, and the feedback issue SHALL then be
closed with `qsm-tasks close <n> --reason "filed as #<task>"`; a feedback issue that will not be
acted on SHALL be closed with `--not-planned`. A subagent SHALL create only this kind of issue.

#### Scenario: Real work that is not now

- **WHEN** the agent finds work the person postponed to next month
- **THEN** `qsm-tasks unclaim --until` is run with the date, and the task is not in the ready list

#### Scenario: Feedback that already exists

- **WHEN** a subagent meets a tool defect and an open feedback issue already holds its title
- **THEN** `qsm-tasks feedback` comments on that issue and creates no second one

#### Scenario: A subagent files feedback from another project

- **WHEN** a subagent runs in a checkout that is not the marketplace
- **THEN** `qsm-tasks feedback` files it in the marketplace repository, not in the checkout's own
  repository

#### Scenario: Feedback is written abstractly

- **WHEN** a subagent writes the body of a feedback issue
- **THEN** it holds what happened as abstract steps and the expected behaviour, and holds no
  suggested fix, no path of the machine and no name of a person

### Requirement: Tasks close on merge into their feature branch, a feature on its merge into main

The skill SHALL state the close rules. A task SHALL be closed by the merge of its pull request into
`feature/<n>` with `Closes #<n>`, which the Action closes; a task with no pull request SHALL be
closed with `qsm-tasks close --reason`. A feature SHALL be closed only by the owner's merge of the
feature pull request into main, which GitHub closes. The agent SHALL NOT close a feature, and
finished work with its task left open SHALL be a failure.

#### Scenario: A task merges

- **WHEN** a pull request with `Closes #N` is merged into `feature/3`
- **THEN** task N is closed by the Action and the board shows it as Done, and the agent does not
  close it again

#### Scenario: The last task closes

- **WHEN** the last open sub-issue of a feature closes
- **THEN** the feature's Status becomes Ready For Test by the Action, the agent does not close the
  feature, and its reply says the feature waits for the QA agent

#### Scenario: A decision with no pull request

- **WHEN** a task is a decision settled in conversation and no code changes
- **THEN** it is closed with `qsm-tasks close --reason`, and no pull request is opened for it

#### Scenario: QA found nothing

- **WHEN** QA has shown every path and the owner has not merged the feature pull request
- **THEN** the feature stays open and its Status stays In Test

### Requirement: Tasks and features move by one Status, and the skill says who moves what

The skill SHALL state the flow of each kind, the verb that moves each step and who may make the
move, and SHALL NOT make the agent move a step GitHub or the Action makes itself. It SHALL NOT copy
the option names or their definitions: it SHALL tell the agent to run `qsm-tasks flow`, which prints
them from the binary. A task SHALL move Todo, In Dev by `claim`, Agent Review when its pull request
is linked (by `review` when the built-in workflow lags or after a finding), Human Review by `human`
when CI is green and every finding is fixed, Done when merged, and needs no QA. A feature SHALL be
Todo while planned, In Dev from its first claimed or completed task, Ready For Test when its last
sub-issue closes, In Test by `qa` when the QA agent takes it, Blocked while a fix task is open under
it, and Done when the owner merges the feature pull request into main, the Action making every move
but `claim` and `qa`, and it needs no review. The QA agent SHALL be the only one to run `qa`, SHALL
find the features that wait with `qsm-tasks ready --qa`, SHALL test every path of the feature's
models, and SHALL file a finding with `qsm-tasks add --feature <n>`. The owner SHALL merge every
pull request; a rejection by the owner is an `add --feature` under the feature, run only on the
owner's word. Everything the skill posts SHALL be written in the owner's name with no mention of an
AI or an agent.

#### Scenario: A pull request is opened

- **WHEN** the agent has opened a pull request for a task
- **THEN** the task is Agent Review by the built-in workflow, the agent runs `review` only if it is
  not, and runs `human` only when CI is green and every review finding is fixed

#### Scenario: The QA agent looks for work

- **WHEN** the QA agent starts
- **THEN** it runs `qsm-tasks ready --qa` and takes a feature from that list with `qa`

#### Scenario: QA finds a defect

- **WHEN** the QA agent finds that a path of the feature's models does not hold
- **THEN** it runs `add --feature <n>` with the defect as title, the Action makes the feature
  Blocked, and when the fix task closes it is Ready For Test and QA runs again

#### Scenario: QA finds nothing

- **WHEN** the QA agent has shown every path with no open finding
- **THEN** it reports that to the owner, and the feature stays In Test until the owner merges the
  feature pull request

#### Scenario: The owner rejects

- **WHEN** the owner says a feature in test is not acceptable
- **THEN** the agent runs `add --feature <n>` with the owner's reason as the title

#### Scenario: The agent is asked what a Status means

- **WHEN** the agent needs the definition of a Status or of done
- **THEN** it runs `qsm-tasks flow` and does not answer from the skill's text

#### Scenario: Something is posted to GitHub

- **WHEN** the skill's steps write a comment, an issue or a field
- **THEN** the text is in the owner's name and names no agent or AI

## REMOVED Requirements

### Requirement: Epics hold the intent of a piece of work, tasks hold one spec change

**Reason**: One name for one concept: the parent of tasks is GitHub's default issue type Feature.

**Migration**: "A feature holds the intent and the change, its tasks are its pull requests".

### Requirement: An epic closes only when the work is proven and pushed

**Reason**: The close rule changed: there is no test-it sub-issue and the agent no longer closes a
feature. It is replaced by "Tasks close on merge into their feature branch, a feature on its merge
into main".

**Migration**: The skill and spec-archive state the new rule; a feature at Ready For Test waits for
the QA agent.

### Requirement: One skill names br

**Reason**: The skill still owns every command name, but the tool is GitHub Issues; the ownership
sentence is now part of "GitHub Issues is the main task tool, reached through the qsm-tasks verbs",
and the rule that only the main agent creates tasks, except feedback, is in "Work not done now is
deferred or filed, and feedback is its own issue type".

**Migration**: Other files keep saying "the task tool" and pointing at the `task-tool` skill.
