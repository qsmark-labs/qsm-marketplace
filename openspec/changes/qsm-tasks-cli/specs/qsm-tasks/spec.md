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
id. A failure SHALL carry an outcome code and a `data.reason`: `usage`, `missing` (`no-gh`,
`no-repo`, `no-board`, `no-feedback-type`, `no-file`), `blocked` (`wrong-kind`, `wrong-status`,
`held`, `private-data`), `failed` (`refused`, `not-found`). A verb SHALL post only the text and
labels it was given, apart from the label `deferred` and the comment `Deferred until <v>`.

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

### Requirement: The repository and the board are resolved, not configured

A verb SHALL act on `--repo owner/name`, else the repository `gh` resolves, else exit `missing`
(`no-repo`); on `--project owner/number`, else the one board linked to it (none: `missing`
`no-board`; several: `usage` naming `--project`). Nothing SHALL be stored. `feedback` SHALL always
act on the repository of the checkout `QSM_MARKETPLACE` names.

#### Scenario: Feedback from another project

- **WHEN** a subagent runs `feedback` in a checkout that is not the marketplace
- **THEN** the issue is made in the marketplace repository

### Requirement: Each verb does one step and checks its guard first

Each verb SHALL do what this table says and, outside its guard, exit `blocked` with `wrong-kind` or
`wrong-status` naming the current value, changing nothing. Body text SHALL reach GitHub on stdin.

| Verb | Kind | Needs | Does |
| --- | --- | --- | --- |
| `ready [--feature n] [--qa]` | read | | open Todo tasks and bugs, unblocked, not `deferred`, by Priority then number; `--qa`: features at Ready For Test |
| `list` | read | | `--feature`, `--kind`, `--status`, `--priority`, `--mine`, `--blocked`, `--label`, `--search`, `--spec <id>` (any state), `--state`, `--limit` |
| `show <n> [--comments]` | read | | facts, blockers, sub-issue counts, body, comments oldest first |
| `feature "<goal>" --intent <file> [--spec <id>]` | feature | | a Feature at Todo, for one an agent creates when the owner asks in chat |
| `add "<title>"` | task | parent open | a Task, `--feature`, `--after`, `--priority`, `--body-file`, `--label` |
| `edit <n>` | any | | `--title`, `--priority`, `--body-file`, `--assignee`, `--feature`, `--after`, `--unblock`, `--spec <id>` (a feature only) |
| `note <n> "<text>"` | any | | one comment, the text unchanged |
| `claim <n>` | task, bug | Todo, unassigned or the caller's | In Dev, assigned to the caller, on the board |
| `unclaim <n> [--until <v>]` | task, bug | In Dev, a review Status, or Todo with `deferred` | Todo, unassigned; `--until`: label `deferred`, comment `Deferred until <v>` |
| `review <n>` | task, bug | In Dev, Agent Review or Human Review | Agent Review |
| `human <n>` | task, bug | Agent Review | Human Review |
| `close <n> --reason <t> [--not-planned]` | any; a feature only not planned with no open sub-issue | open | closed with the reason as a comment, no Status |
| `reopen <n>` | task, bug, feedback | closed, parent open | open, Todo |
| `plan <feature>` | feature | In Dev, Ready For Test or Blocked | Todo |
| `qa <feature>` | feature | Ready For Test, no open sub-issue | In Test |

`--spec <id>` SHALL write the label `change:<id>`, created first when missing; an id over GitHub's
50-character label limit SHALL exit `usage` before any call.

#### Scenario: P0 comes first, blocked and deferred stay out

- **WHEN** tasks 4 (P2), 7 (P0), 9 (no priority) and 11 (P0) are ready, task 2 is blocked by open
  task 1 and task 3 is deferred
- **THEN** `ready` lists 1, 7, 11, 4, 9 in that order

#### Scenario: A change's feature, exactly and in any state

- **WHEN** `list --spec add-x` runs, a feature labelled `change:add-x-more` exists and the feature
  labelled `change:add-x` is closed
- **THEN** only the closed feature labelled `change:add-x` is printed

#### Scenario: Planning binds a filed feature, and a task is never bound

- **WHEN** `edit 3 --spec report-export` runs on feature 3, then `edit 12 --spec report-export` on
  a task
- **THEN** feature 3 carries `change:report-export`, and the second exits `blocked` with
  `wrong-kind` and changes nothing

#### Scenario: A refused relation or a closed parent

- **WHEN** `edit 1 --after 2` would make a cycle, or `add --feature 3` names a closed feature
- **THEN** the first exits `failed` carrying GitHub's cause, the second `blocked` with
  `wrong-status`, and nothing changes

#### Scenario: Held by someone else, or a skipped step

- **WHEN** `claim` runs on a task assigned to another login, or `human` on a task In Dev
- **THEN** the first exits `blocked` with `held` naming the login, the second with `wrong-status`
  naming In Dev and Agent Review

#### Scenario: Deferred and brought back

- **WHEN** `unclaim 5 --until 2026-12-01` runs on a task In Dev, then later `unclaim 5`
- **THEN** after the first `ready` leaves it out and its last comment is `Deferred until
  2026-12-01`, and after the second the label is gone and `ready` lists it

#### Scenario: QA before the feature is ready

- **WHEN** `qa` runs on a feature at In Dev, or at Ready For Test with an open sub-issue
- **THEN** it exits `blocked` with `wrong-status` naming why, and the feature is unchanged

### Requirement: Feedback is an issue of its own type, labelled, abstract, and with no fix

`feedback "<title>" --area <a> --kind <k> --from <who>` SHALL file an issue of type Feedback with no
parent, labelled `area:`, `kind:` and `from:`, the area `marketplace` or a plugin of
`marketplace.json`, the kind `tool-broken`, `tool-missing`, `wrong-output`, `guidance` or
`agent-mistake`, who `user`, `main-agent` or `subagent`. The body SHALL hold `## What happened` and
`## Expected behaviour`, MAY hold `## Context`, and no other `##`. A home path, the OS login, the
hostname, an email or a secret shape SHALL be refused as `private-data`, naming the kind and line,
never the text. An open Feedback issue with the same title SHALL get the body as a comment. The
rules SHALL live in `lib/feedback.ts`.

#### Scenario: A refused feedback

- **WHEN** the body holds `/home/<login>/x`, or the heading `## Suggested fix`, or `--area` names no
  plugin
- **THEN** the first exits `blocked` with `private-data` naming the kind and line but not the text,
  the others exit `usage`, and nothing is posted

### Requirement: One Status field and the flow table are data the verbs read

`lib/flow.ts` SHALL hold the Status and Priority options, their definitions per kind, each verb's
guard and the derivation of the model `models/qsm-tasks/feature-status.bpmn`; no other copy of a
name SHALL exist in the binary except the Action's file, which `doctor` checks. `flow` SHALL print
the table. A Status a kind does not use SHALL be refused with `wrong-kind`.

| Status | Task and Bug | Feature | Feedback |
| --- | --- | --- | --- |
| Todo | Not started | Being planned: intent, models, specs | Filed, not yet read |
| In Dev | Claimed and being built | Split into tasks, built on `feature/<n>` | not used |
| Agent Review | PR open: CI, gates and the review agent run; every finding is fixed | not used | not used |
| Human Review | CI green and no open finding: the owner reads and merges | not used | not used |
| Ready For Test | not used | Every task closed and `feature/<n>` up to date with main: waits for QA | not used |
| In Test | not used | The QA agent runs the scenarios of the cover in a sandbox | not used |
| Blocked | not used | QA found something: a fix task is open | not used |
| Done | Merged into `feature/<n>` by the owner with Closes #N | The owner merged the feature pull request into main | Read and settled |

| Priority | Definition |
| --- | --- |
| P0 | Breaks something in use or blocks the work in hand: next |
| P1 | Needed for the current feature |
| P2 | Worth doing, no date |

#### Scenario: A Status that is not an option, or not the kind's

- **WHEN** `list --status Reviewing` runs, or a verb would set a task to In Test
- **THEN** the first exits `usage` listing the names, the second `blocked` with `wrong-kind`

### Requirement: A feature's Status is derived, and the Action is its only writer

Apart from `plan` and `qa`, a feature's Status SHALL change only by the rule of
`models/qsm-tasks/feature-status.bpmn`, applied by `.github/workflows/qsm-tasks.yml` when a
sub-issue of a Feature opens, closes or reopens. When the last task closes, the workflow SHALL merge
main into `feature/<n>` and set Ready For Test only when that is clean; on a conflict it SHALL file
one task `Resolve the conflict of feature/<n> with main` under the feature. It SHALL use `gh` and
the secret `PROJECT_TOKEN`, and serialise two events under one parent.

#### Scenario: The split starts development (path p-e4f7c4)

- **WHEN** the first sub-issue is added under a feature at Todo
- **THEN** the feature is In Dev

#### Scenario: A late event while nothing is open at Todo (path p-86757e)

- **WHEN** an event of a closed sub-issue reaches a feature at Todo with no sub-issue open
- **THEN** the feature stays Todo

#### Scenario: A task merges and others are open (path p-083513)

- **WHEN** a sub-issue of a feature at In Dev closes and another is open
- **THEN** the Status is unchanged

#### Scenario: The last task closes and main merges in clean (path p-b8fc2e)

- **WHEN** the last open sub-issue of a feature at In Dev or Blocked closes, one of them completed,
  and main merges into `feature/<n>` without a conflict
- **THEN** the feature is Ready For Test within a minute

#### Scenario: The last task closes and main conflicts (path p-d90e26)

- **WHEN** the last open sub-issue closes and merging main into `feature/<n>` conflicts
- **THEN** a conflict task is open under the feature, the Status stays In Dev, and Ready For Test
  follows the merge of its resolution pull request

#### Scenario: Every task was dropped (path p-afc6b3)

- **WHEN** the last open sub-issue of a feature at In Dev closes and none closed as completed
- **THEN** the Status is unchanged, and the owner or an agent closes the feature with
  `close --not-planned`

#### Scenario: A task is added to a feature that waits for QA (path p-fd1c94)

- **WHEN** an open sub-issue appears under a feature at Ready For Test
- **THEN** the Action sets In Dev

#### Scenario: An event with nothing open while QA waits (path p-3daef6)

- **WHEN** a sub-issue event reaches a feature at Ready For Test with no sub-issue open
- **THEN** the Status stays Ready For Test

#### Scenario: QA files a finding (path p-17fcd1)

- **WHEN** QA runs `add --feature 3 "export drops the last row"` on a feature In Test
- **THEN** a task exists under feature 3 and the Action sets Blocked

#### Scenario: An event under test with nothing open (path p-98bc6e)

- **WHEN** a sub-issue of a feature In Test is closed and none is open
- **THEN** the Status stays In Test until the owner merges the feature pull request

#### Scenario: A late event on a done feature (path p-2ecc9b)

- **WHEN** a sub-issue of a closed feature is edited, closed or reopened
- **THEN** the feature's Status is unchanged

### Requirement: Done is GitHub's, and the Action closes what a feature-branch merge names

"Item closed" SHALL set Done for every closed issue, never a verb. GitHub SHALL close a feature when
the feature pull request with `Closes #<feature>` merges into main. When a pull request merges
into `feature/*`, `.github/workflows/qsm-tasks.yml` SHALL close as completed each issue its body
names with `Closes #N`, because GitHub does that only for the default branch.

#### Scenario: A task pull request merges into the feature branch

- **WHEN** a pull request with `Closes #12` merges into `feature/3`
- **THEN** task 12 is closed as completed within a minute and `show 12` prints Status Done

#### Scenario: A pull request into a feature branch is closed unmerged

- **WHEN** a pull request into `feature/3` that names `Closes #12` is closed unmerged
- **THEN** task 12 stays open

### Requirement: Only lib/github talks to GitHub

Only `lib/github/` SHALL name `gh`, a node id, an issue type, a project field or a GraphQL query,
through one `Run(args, stdin)`; verbs and `lib/flow.ts` SHALL see plain items. A read SHALL be one
GraphQL query.

#### Scenario: A verb is tested without GitHub

- **WHEN** a flow test runs the built binary with a recording fake `gh` on `PATH`
- **THEN** it asserts the calls `gh` received, and no output holds a node, field or option id

### Requirement: doctor and setup check and create what the API allows

`doctor` SHALL print one line per check, `ok`, `failed` or `manual`, and exit `ok`, `partial` when
only `manual` remain, else `missing` or `failed`: `gh` with a login and the `project` scope; the
repository and its board; the issue types Feature, Task, Bug, Feedback; the fields Status and
Priority with exactly the flow table's names; the labels `deferred`, `kind:*`, `from:*`; the
built-in workflows "Auto-add to project", "Auto-add sub-issues to project", "Item added to project"
(Todo), "Item closed" (Done), "Pull request linked to issue" (Agent Review); the views Tasks and
Features; `.github/workflows/qsm-tasks.yml`; the secret `PROJECT_TOKEN`. `setup` SHALL create the
missing fields, options, the type Feedback and the labels, never rename or delete, and print the
rest as `doctor` does.

#### Scenario: A leftover

- **WHEN** the board still has a field `Epic stage` or a Status option In Progress
- **THEN** that line is `failed` naming the project's web-UI page, and `setup` is not named

#### Scenario: A new board, run twice

- **WHEN** `setup` runs against a board with no fields, then again
- **THEN** the first creates both fields with all options and definitions, the second creates
  nothing and says so

### Requirement: Install compiles and links the binary

`scripts/install.ts` SHALL be one `installScript(import.meta)` call: it compiles `qsm-tasks`,
links it onto PATH and writes completions, and a second run SHALL change nothing.

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

**Reason**: The install now compiles and links `qsm-tasks`; there is no `br` to probe.

**Migration**: "Install compiles and links the binary".

### Requirement: No binary, the install is the doctor

**Reason**: The plugin now ships a binary and a `doctor` verb that checks the whole task tool.

**Migration**: "One binary, qsm-tasks, serves the task port" and "doctor and setup check and create
what the API allows".
