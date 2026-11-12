## ADDED Requirements

### Requirement: One binary, qsm-tasks, serves the task port

The plugin SHALL ship one binary `qsm-tasks`, named after the plugin, its verbs in `qsm.json` and
its noun `$.tasks`, covering every step of the task flow so no step needs raw `gh`, `jq` or
GraphQL. It SHALL NOT touch pull requests, review threads or git state. Its verbs SHALL be `ready`,
`list`, `show`, `feature`, `add`, `feedback`, `edit`, `note`, `claim`, `unclaim`, `review`, `human`,
`close`, `reopen`, `plan`, `qa`, `doctor`, `flow` and `setup`.

#### Scenario: A step of the flow needs a task operation

- **WHEN** an agent has to create a sub-issue, order two tasks, claim a task or hand a feature to QA
- **THEN** one `qsm-tasks` verb does it, and the agent composes no GitHub call

### Requirement: Output is deterministic text and an envelope, a failure is a typed outcome

Every verb SHALL print text an agent reads without parsing and, with `--json`, the envelope of
`lib/cli-base.ts`: a list row `#<n> [<Status>] <title>` with priority, assignee and open blockers,
a write `#<n> <from> -> <to>` per write, an empty list `none`, and no node id, field id or option
id.

#### Scenario: An empty list and a write

- **WHEN** `list` finds no task, and `claim 5` then moves task 5 from Todo to In Dev
- **THEN** the first prints `none` and the second prints `#5 Todo -> In Dev`

### Requirement: A failure is a typed outcome with a reason

A failure SHALL carry an outcome code and a `data.reason`: `usage`, `missing` (`no-gh`, `no-repo`,
`no-board`, `no-file`), `blocked` (`wrong-kind`, `wrong-status`, `held`,
`private-data`), `failed` (`refused`, `not-found`).

#### Scenario: A wrong call runs nothing

- **WHEN** a verb gets an unknown flag, a missing required argument or a value outside its choices
- **THEN** it exits `usage` and the recorded `gh` calls are empty

#### Scenario: The token lacks the project scope

- **WHEN** GitHub refuses a write because the login has no `project` scope
- **THEN** the verb exits `failed` with reason `refused`, GitHub's words and `next` set to
  `gh auth refresh -s project`, and nothing is created another way

#### Scenario: A verb of several writes is repeated after a refusal

- **WHEN** the second of two writes is refused and the verb is run again
- **THEN** the first write is found done and only the second is made

### Requirement: A verb posts only what it was given

A verb SHALL post only the text and labels it was given, apart from the label `deferred` and the
comment `Deferred until <v>`.

#### Scenario: A note is posted unchanged

- **WHEN** `note 5 "waiting for the API key"` runs
- **THEN** one comment with exactly that text is posted and nothing else is added

### Requirement: The repository and the board are resolved, not configured

A verb SHALL act on `--repo owner/name`, else the repository `gh` resolves, else exit `missing`
(`no-repo`); on `--project owner/number`, else the one board linked to it (none: `missing`
`no-board`; several: `usage` naming `--project`). Nothing SHALL be stored. `feedback` SHALL always
act on the repository of the checkout `QSM_MARKETPLACE` names.

#### Scenario: Feedback from another project

- **WHEN** a subagent runs `feedback` in a checkout that is not the marketplace
- **THEN** the issue is made in the marketplace repository

### Requirement: Each verb does one step and checks its guard first

Each verb SHALL do one step and, outside its guard, exit `blocked` with `wrong-kind` or
`wrong-status` naming the current value, changing nothing.

#### Scenario: A refused relation or a closed parent

- **WHEN** `edit 1 --after 2` would make a cycle, or `add --feature 3` names a closed feature
- **THEN** the first exits `failed` carrying GitHub's cause, the second `blocked` with
  `wrong-status`, and nothing changes

#### Scenario: Held by someone else, or a skipped step

- **WHEN** `claim` runs on a task assigned to another login, or `human` on a task In Dev
- **THEN** the first exits `blocked` with `held` naming the login, the second with `wrong-status`
  naming In Dev and Agent Review

### Requirement: ready and list read the open work

`ready` and `list` SHALL do what their row says.

| Verb | Kind | Needs | Does |
| --- | --- | --- | --- |
| `ready [--feature n] [--qa]` | read | | open Todo tasks and bugs, unblocked, not `deferred`, by Priority then number; `--qa`: features at Ready For Test |
| `list` | read | | `--feature`, `--kind`, `--status`, `--priority`, `--mine`, `--blocked`, `--label`, `--search`, `--spec <id>` (any state), `--state`, `--limit` |

#### Scenario: P0 comes first, blocked and deferred stay out

- **WHEN** tasks 4 (P2), 7 (P0), 9 (no priority) and 11 (P0) are ready, task 2 is blocked by open
  task 1 and task 3 is deferred
- **THEN** `ready` lists 1, 7, 11, 4, 9 in that order

#### Scenario: A change's feature, exactly and in any state

- **WHEN** `list --spec add-x` runs, a feature labelled `change:add-x-more` exists and the feature
  labelled `change:add-x` is closed
- **THEN** only the closed feature labelled `change:add-x` is printed

### Requirement: show and note read and comment on one issue

`show` and `note` SHALL do what their row says.

| Verb | Kind | Needs | Does |
| --- | --- | --- | --- |
| `show <n> [--comments]` | read | | facts, blockers, sub-issue counts, body, comments oldest first |
| `note <n> "<text>"` | any | | one comment, the text unchanged |

#### Scenario: A task with its comments

- **WHEN** `show 5 --comments` runs on a task with two blockers and three comments
- **THEN** it prints the facts, the blockers, the sub-issue counts, the body and the comments oldest
  first

### Requirement: feature and add create a feature or a task

`feature` and `add` SHALL do what their row says.

| Verb | Kind | Needs | Does |
| --- | --- | --- | --- |
| `feature "<goal>" --intent <file> [--spec <id>]` | feature | | a Feature at Todo, for one an agent creates when the owner asks in chat |
| `add "<title>"` | task | parent open | a Task, `--feature`, `--after`, `--priority`, `--body-file`, `--label` |

#### Scenario: A feature is filed and a task is added

- **WHEN** `feature "Export" --intent intent.md` runs, then `add "Write the CSV" --feature 3`
- **THEN** a Feature exists at Todo, and the Task is its sub-issue

### Requirement: edit and close change or end one issue

`edit` and `close` SHALL do what their row says.

| Verb | Kind | Needs | Does |
| --- | --- | --- | --- |
| `edit <n>` | any | | `--title`, `--priority`, `--body-file`, `--assignee`, `--feature`, `--after`, `--unblock`, `--spec <id>` (a feature only) |
| `close <n> --reason <t> [--not-planned]` | any; a feature only not planned with no open sub-issue | open | closed with the reason as its newest comment, posted once, no Status |

#### Scenario: A feature with an open task is closed as not planned

- **WHEN** `close 3 --reason "dropped" --not-planned` runs on a feature with an open sub-issue
- **THEN** it exits `blocked` with `wrong-status` and the feature stays open

### Requirement: claim and unclaim take a task or give it back

`claim` and `unclaim` SHALL do what their row says.

| Verb | Kind | Needs | Does |
| --- | --- | --- | --- |
| `claim <n>` | task, bug | Todo, unassigned or the caller's | In Dev, assigned to the caller, on the board |
| `unclaim <n> [--until <v>]` | task, bug | In Dev, a review Status, or Todo with `deferred` | Todo, unassigned; `--until`: label `deferred`, comment `Deferred until <v>` |

#### Scenario: Deferred and brought back

- **WHEN** `unclaim 5 --until 2026-12-01` runs on a task In Dev, then later `unclaim 5`
- **THEN** after the first `ready` leaves it out and its last comment is `Deferred until
  2026-12-01`, and after the second the label is gone and `ready` lists it

### Requirement: review and human hand a task to the reviewers

`review` and `human` SHALL do what their row says.

| Verb | Kind | Needs | Does |
| --- | --- | --- | --- |
| `review <n>` | task, bug | In Dev, Agent Review or Human Review | Agent Review |
| `human <n> --pr <m>` | task, bug | Agent Review; PR `<m>` based on `feature/<parent>`, saying `Closes #<n>`, checks green, no review asking for changes | Ready For Human |
| `human <n> --started` | task, bug | Ready For Human | Human Review |

#### Scenario: A task goes to review

- **WHEN** `review 5` runs on a task In Dev
- **THEN** the task is at Agent Review

#### Scenario: The owner says a Human Review is good

- **WHEN** `review 5` runs on a task at Human Review
- **THEN** the task is at Agent Review, and the PR goes back to the review agent

#### Scenario: A task is handed to the owner

- **WHEN** `human 5 --pr 9` runs on a task at Agent Review under feature 3, and PR 9 is based on
  `feature/3`, says `Closes #5`, has green checks and no review asking for changes, and then
  `human 5 --started` runs after the owner's first review
- **THEN** the task is at Ready For Human and then at Human Review; until `status-action` (#15)
  does the second move on the owner's first review, the agent runs `human --started` on seeing it

#### Scenario: The named PR is not the task's ready PR

- **WHEN** `human 5 --pr 9` runs on a task at Agent Review and PR 9 is based on another branch,
  does not say `Closes #5`, has a check that is not green, or has a review asking for changes
- **THEN** it exits `blocked` with `wrong-status` naming what fails, writes nothing, and the task
  stays at Agent Review

### Requirement: reopen and plan return work to Todo, qa starts the test

`reopen`, `plan` and `qa` SHALL do what their row says.

| Verb | Kind | Needs | Does |
| --- | --- | --- | --- |
| `reopen <n>` | task, bug, feedback | closed, parent open | open, Todo |
| `plan <feature>` | feature | In Dev, Ready For Test or Blocked | Todo |
| `qa <feature>` | feature | Ready For Test, no open sub-issue | In Test |

#### Scenario: QA before the feature is ready

- **WHEN** `qa` runs on a feature at In Dev, or at Ready For Test with an open sub-issue
- **THEN** it exits `blocked` with `wrong-status` naming why, and the feature is unchanged

### Requirement: Body text reaches GitHub on stdin

A verb that sends body text SHALL pass it to GitHub on stdin.

#### Scenario: A body with quotes and newlines

- **WHEN** `add "Export" --body-file body.md` runs and the file holds quotes and several lines
- **THEN** the recorded `gh` call received the body on stdin, unchanged, and not as an argument

### Requirement: A spec id becomes the label change:id

`--spec <id>` SHALL write the label `change:<id>`, created first when missing; an id over GitHub's
50-character label limit SHALL exit `usage` before any call.

#### Scenario: Planning binds a filed feature, and a task is never bound

- **WHEN** `edit 3 --spec report-export` runs on feature 3, then `edit 12 --spec report-export` on
  a task
- **THEN** feature 3 carries `change:report-export`, and the second exits `blocked` with
  `wrong-kind` and changes nothing

#### Scenario: An id over the label limit

- **WHEN** `edit 3 --spec` gets an id of 60 characters
- **THEN** it exits `usage` and the recorded `gh` calls are empty

### Requirement: Feedback is a plain issue from the template, labelled, abstract, and with no fix

`feedback "<title>" --area <a> --kind <k> --from <who>` SHALL file an issue with no issue type and
no parent, shaped like the repository's template `.github/ISSUE_TEMPLATE/feedback.yml`, labelled
`feedback`, `area:`, `kind:` and `from:`; the label `feedback` makes it the kind Feedback. The area
is `marketplace` or a plugin of
`marketplace.json`, the kind `tool-broken`, `tool-missing`, `wrong-output`, `guidance` or
`agent-mistake`, who `user`, `main-agent` or `subagent`.

#### Scenario: An area that names no plugin

- **WHEN** `feedback` runs with `--area` naming no plugin of `marketplace.json`
- **THEN** it exits `usage` and nothing is posted

### Requirement: A feedback body has fixed sections and no fix

The body SHALL hold the template's four sections, `## What happened`, `## Where`,
`## How to reproduce` (in the abstract) and `## Expected behaviour`, and no other `##`. The rules of
feedback SHALL live in `lib/feedback.ts`.

#### Scenario: A body with a suggested fix

- **WHEN** the body holds the heading `## Suggested fix`
- **THEN** `feedback` exits `usage` and nothing is posted

### Requirement: Feedback with private data is refused

A home path, the OS login, the hostname, an email or a secret shape SHALL be refused as
`private-data`, naming the kind and line, never the text.

#### Scenario: A body with a home path

- **WHEN** the body holds `/home/<login>/x`
- **THEN** `feedback` exits `blocked` with `private-data` naming the kind and line but not the text,
  and nothing is posted

### Requirement: A feedback with an open title becomes a comment

An open issue labelled `feedback` with the same title SHALL get the body as a comment.

#### Scenario: The same feedback twice

- **WHEN** `feedback` runs twice with the same title while the first issue is open
- **THEN** the second run posts its body as a comment on the first issue and creates no new issue

### Requirement: One Status field and the flow table are data the verbs read

`lib/flow.ts` SHALL hold the Status and Priority options, their definitions per kind and each
verb's guard; no other copy of a name SHALL exist in the binary.

#### Scenario: A verb names a Status

- **WHEN** a verb sets or reads a Status
- **THEN** it takes the name from `lib/flow.ts`, and a search of the binary's source finds the name
  nowhere else

### Requirement: Todo, In Dev and Agent Review are defined per kind

`flow` SHALL define Todo, In Dev and Agent Review per kind as follows.

| Status | Task and Bug | Feature | Feedback |
| --- | --- | --- | --- |
| Todo | Not started | Being planned: intent, models, specs | Filed, not yet read |
| In Dev | Claimed and being built | Split into tasks, built on `feature/<n>` | not used |
| Agent Review | PR open: CI, gates and the review agent run; findings fixed at once | not used | not used |

#### Scenario: A task has a pull request open

- **WHEN** `flow` runs
- **THEN** the Agent Review row reads that CI, the gates and the review agent run and findings are
  fixed at once, with a reply in the thread and a new review asked

### Requirement: Ready For Human and Human Review are defined per kind

`flow` SHALL define Ready For Human and Human Review per kind as follows.

| Status | Task and Bug | Feature | Feedback |
| --- | --- | --- | --- |
| Ready For Human | The review agent found nothing, CI green: waits for the owner | not used | not used |
| Human Review | The owner reviews, the agent fixes his comments; no review agent | not used | not used |

#### Scenario: A task waits for the owner, then the owner reviews

- **WHEN** `flow` runs
- **THEN** the Ready For Human row reads that the review agent found nothing and the CI is green,
  and the Human Review row reads that the owner reviews, the agent fixes his comments and the review
  agent is not asked

### Requirement: Ready For Test and In Test are defined per kind

`flow` SHALL define Ready For Test and In Test per kind as follows.

| Status | Task and Bug | Feature | Feedback |
| --- | --- | --- | --- |
| Ready For Test | not used | Every task closed and `feature/<n>` up to date with main: waits for QA | not used |
| In Test | not used | The QA agent runs the scenarios of the cover in a sandbox | not used |

#### Scenario: A feature waits for QA

- **WHEN** `flow` runs
- **THEN** the Ready For Test row reads that every task is closed and `feature/<n>` is up to date
  with main

### Requirement: Blocked and Done are defined per kind

`flow` SHALL define Blocked and Done per kind as follows.

| Status | Task and Bug | Feature | Feedback |
| --- | --- | --- | --- |
| Blocked | not used | QA found something: a fix task is open | not used |
| Done | Merged into `feature/<n>` by the owner with Closes #N | The owner merged the feature pull request into main | Read and settled |

#### Scenario: QA found something

- **WHEN** `flow` runs
- **THEN** the Blocked row reads that QA found something and a fix task is open

### Requirement: The Priority table defines P0, P1 and P2

`flow` SHALL define the Priorities as follows.

| Priority | Definition |
| --- | --- |
| P0 | Breaks something in use or blocks the work in hand: next |
| P1 | Needed for the current feature |
| P2 | Worth doing, no date |

#### Scenario: The next task

- **WHEN** `flow` runs
- **THEN** P0 reads as breaking something in use or blocking the work in hand, and as next

### Requirement: flow prints the table and a foreign Status is refused

`flow` SHALL print the table. A Status a kind does not use SHALL be refused with `wrong-kind`.

#### Scenario: The table is printed

- **WHEN** `qsm-tasks flow` runs
- **THEN** it prints the Status table and the Priority table of `lib/flow.ts`

#### Scenario: A Status that is not an option, or not the kind's

- **WHEN** `list --status Reviewing` runs, or a verb would set a task to In Test
- **THEN** the first exits `usage` listing the names, the second `blocked` with `wrong-kind`

### Requirement: Only lib/github talks to GitHub

Only `lib/github/` SHALL name `gh`, a node id, an issue type, a project field or a GraphQL query,
through one `Run(args, stdin)`; verbs and `lib/flow.ts` SHALL see plain items. A read SHALL be one
GraphQL query.

#### Scenario: A verb is tested without GitHub

- **WHEN** a flow test runs the built binary with a recording fake `gh` on `PATH`
- **THEN** it asserts the calls `gh` received, and no output holds a node, field or option id

### Requirement: doctor prints one line per check and exits by the worst

`doctor` SHALL print one line per check, `ok`, `failed` or `manual`, and exit `ok`, `partial` when
only `manual` remain, else `missing` or `failed`.

#### Scenario: Only manual checks remain

- **WHEN** every check is `ok` except one that the API cannot read, so it is `manual`
- **THEN** `doctor` prints that line as `manual` and exits `partial`

### Requirement: doctor checks the login, the repository and the board

`doctor` SHALL check `gh` with a login and the `project` scope, the repository and its board, the
issue types Feature, Task and Bug, the fields Status and Priority with exactly the flow table's
names, and the labels `feedback`, `deferred`, `kind:*` and `from:*`.

#### Scenario: A leftover

- **WHEN** the board still has a field `Epic stage` or a Status option In Progress
- **THEN** that line is `failed` naming the project's web-UI page, and `setup` is not named

### Requirement: doctor checks the board's workflows, views and the feedback template

`doctor` SHALL check the built-in workflows "Auto-add to project", "Auto-add sub-issues to
project", "Item added to project" (Todo), "Item closed" (Done) and "Pull request linked to issue"
(Agent Review), the views Tasks and Features, and `.github/ISSUE_TEMPLATE/feedback.yml`.

#### Scenario: The feedback template is missing

- **WHEN** `.github/ISSUE_TEMPLATE/feedback.yml` does not exist in the repository
- **THEN** `doctor` prints that check as `failed`

### Requirement: setup creates what is missing and never renames or deletes

`setup` SHALL create the missing fields, options and labels, never rename or delete, and print the
rest as `doctor` does.

#### Scenario: A new board, run twice

- **WHEN** `setup` runs against a board with no fields, then again
- **THEN** the first creates both fields with all options and definitions, the second creates
  nothing and says so

### Requirement: Install compiles and links the binary

`scripts/install.ts` SHALL be one `installScript` call: it compiles `qsm-tasks`, links it onto
PATH and writes completions, and probes `gh`, which every verb but `flow` runs, and `br` while the
skills still drive it, naming how to install each one missing. A second run SHALL change nothing.

#### Scenario: Installed on a clean machine

- **WHEN** `qsm-setup install qsm-tasks` runs
- **THEN** `qsm-tasks --help` lists the verbs of this spec and a second install changes nothing

## MODIFIED Requirements

### Requirement: Dependencies

The plugin SHALL declare no plug-in in `dependencies`: the binary imports root `lib/` and itself
only. Its one prerequisite is `gh` on PATH with a login that has the `project` scope, checked by
`doctor`; without it every verb exits `missing` naming `gh`.

#### Scenario: gh is missing

- **WHEN** a verb runs with `gh` not on PATH
- **THEN** it exits `missing` naming `gh` and does nothing else

## REMOVED Requirements

### Requirement: Install puts br on the machine or says how

**Reason**: The install now compiles and links `qsm-tasks`, and probes `br` beside `gh` there.

**Migration**: "Install compiles and links the binary".

### Requirement: No binary, the install is the doctor

**Reason**: The plugin now ships a binary and a `doctor` verb that checks the whole task tool.

**Migration**: "One binary, qsm-tasks, serves the task port", "doctor prints one line per check and
exits by the worst" and "setup creates what is missing and never renames or deletes".
