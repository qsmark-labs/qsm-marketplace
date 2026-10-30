## ADDED Requirements

### Requirement: One binary, qsm-tasks, serves the task port

The plugin SHALL ship one binary `qsm-tasks`, named after the plugin, whose verbs are described in
`qsm.json` and whose noun is `$.tasks`, so a person, a script and a hook reach the same logic: a
hook calls `$.tasks.<verb>()` where a person runs `qsm-tasks <verb>`. The binary SHALL cover every
step of the task flow, so that no step needs a raw `gh`, `jq` or GraphQL call, and SHALL NOT touch
pull requests, review threads or git state. Its verbs SHALL be: `ready`, `list`, `show`, `feature`,
`add`, `feedback`, `edit`, `note`, `claim`, `unclaim`, `review`, `human`, `close`, `reopen`, `plan`,
`qa`, `accept`, `doctor`, `flow` and `setup`.

#### Scenario: A step of the flow needs a task operation

- **WHEN** an agent has to create a sub-issue, order two tasks, claim a task or hand a feature to QA
- **THEN** one `qsm-tasks` verb does it, and the agent composes no backend call

### Requirement: Output is deterministic text and an envelope, a failure is a typed outcome

Every verb SHALL print text an agent reads without parsing and, with `--json`, the envelope of
`lib/cli-base.ts` whose `data` carries the same facts. A list row SHALL be
`#<n> [<Status>] <title>`, with the Priority after the bracket when set, then `@<login>` when
assigned, then `blocked by` and the open blockers' numbers when any exist, and a feature row SHALL
add `done/total` sub-issues. A list SHALL be in ascending issue number unless the verb says
otherwise, and an empty list SHALL print `none`. A write verb SHALL print one line per write,
`#<n> <from> -> <to>`. The `data` of an item SHALL hold `number`, `url`, `title`, `kind`, `state`,
`closeReason`, `status`, `priority`, `assignee`, `parent`, `blockedBy`, `labels` and
`subIssues: { total, completed }`, and a write verb's `data` SHALL add
`changes: [{ number, field, from, to }]`. No output SHALL carry a node id, a field id, an option id
or a backend's own shape, colour, a relative time or an emoji.

Every failure SHALL carry one of the marketplace's outcome codes and a stable `data.reason`, name
the cause and, when there is one, the single fix as `next`. A wrong call SHALL exit `usage` (2)
before any backend call. An absent prerequisite SHALL exit `missing` (4) with reason `no-gh` (no
`gh`, or no login: `next` is `gh auth login`), `no-repo`, `no-board`, `no-feedback-type` or
`no-file`. A refused move SHALL exit `blocked` (5) with reason `wrong-kind`, `wrong-status` (the
message names the current Status, the open sub-issues or the closed feature), `held` or
`private-data`, and change nothing. A refusal by GitHub SHALL exit `failed` (1) with reason
`refused` carrying its words, and a missing issue with reason `not-found`. A verb SHALL NOT retry,
take a second route, roll back or continue after a refusal; a verb of several writes SHALL make each
write idempotent and name the writes already done, so a repeat finishes the work.

#### Scenario: A write that touches two issues

- **WHEN** `claim` moves a task to In Dev and its feature from Todo to In Dev
- **THEN** two lines print, `#12 Todo -> In Dev` and `#3 Todo -> In Dev`, and `changes` holds both

#### Scenario: A wrong call runs nothing

- **WHEN** a verb gets an unknown flag, a missing required argument or a value outside its choices
- **THEN** it exits `usage` and the recorded `gh` calls are empty

#### Scenario: The token lacks the project scope

- **WHEN** GitHub refuses a write because the login has no `project` scope
- **THEN** the verb exits `failed` with reason `refused`, GitHub's words and `next` set to
  `gh auth refresh -s project`, and nothing is created another way

### Requirement: The repository and the board are resolved, not configured

A verb SHALL act on the repository named by `--repo owner/name`, else on the repository `gh`
resolves from the working directory, else exit `missing` with reason `no-repo`. It SHALL act on the
board named by `--project owner/number`, else on the one Projects v2 board linked to the repository;
none SHALL exit `missing` with reason `no-board` and several SHALL exit `usage` naming `--project`.
The binary SHALL store no default for either. `feedback` SHALL always act on the marketplace
repository, taken from the checkout that `QSM_MARKETPLACE` names, whatever the working directory.

#### Scenario: Feedback from another project

- **WHEN** a subagent runs `feedback` in a checkout that is not the marketplace
- **THEN** the issue is made in the marketplace repository

### Requirement: Read verbs

`ready` SHALL list open issues of kind Task or Bug whose Status is Todo, that no open issue blocks
and that do not carry the label `deferred`, never a Feature and never Feedback, optionally under
`--feature <n>`, ordered by Priority (P0, P1, P2, then none) and within one priority by ascending
number. `ready --qa` SHALL list the open features that the guard of `qa` accepts. `list` SHALL list
issues filtered by `--feature <n>` (the feature first, then its sub-issues), `--kind` (`feature`,
`task`, `bug` or `feedback`), `--status`, `--priority`, `--mine` (assigned to the caller),
`--blocked`, `--label`, `--search "<words>"` (title and body), `--spec <change-id>` (the issue
labelled `change:<change-id>`, or `none`) and `--state` (open by default), up to `--limit`. `show
<n>` SHALL print an item's facts, blockers, sub-issue counts and body, and with `--comments` its
comments oldest first as `<date> <login>: <text>`. A list that reaches its limit SHALL say it is
cut, as a warning, and still exit `ok`.

#### Scenario: What is ready

- **WHEN** task 2 is blocked by open task 1, task 3 is deferred, task 4 is In Dev, feature 5 is open
  and task 6 is blocked by closed task 7
- **THEN** `ready` lists 1 and 6 and none of the others

#### Scenario: P0 comes first

- **WHEN** ready tasks 4 (P2), 7 (P0), 9 (no priority) and 11 (P0) exist
- **THEN** `ready` lists 7, 11, 4, 9

#### Scenario: The QA agent's list

- **WHEN** feature 3 is Ready For Test, feature 5 is In Dev with every sub-issue closed and feature
  8 is In Dev with an open sub-issue
- **THEN** `ready --qa` lists 3 and 5, and not 8

#### Scenario: A change's task

- **WHEN** `list --spec add-x` runs and an issue `add-x-more` is labelled `change:add-x-more`
- **THEN** only the issue labelled `change:add-x` is printed, or `none` with `data.items` empty

### Requirement: Create and edit verbs

`feature "<goal>" --intent <file or ->` SHALL create an issue of kind Feature whose body is the
intent, with Status Todo. `add "<title>"` SHALL create a Task, optionally a sub-issue of
`--feature`, blocked by `--after`, labelled `change:<id>` by `--spec`, with `--priority`, `--body`
or `--body-file` and `--label`. `edit <n>` SHALL change `--title`, `--priority`, `--body` or
`--body-file`, `--assignee <login>` (without changing Status), `--feature <m>` (a sub-issue of m,
leaving an earlier parent), `--after <b>` (n is blocked by b), `--unblock <b>` (lift it) and
`--spec <id>` (replace the `change:` label). `note <n> "<text>"` SHALL add one comment with the text
unchanged. No verb SHALL put an open sub-issue under a closed feature (`wrong-status`). A relation
GitHub refuses (a cycle, a missing issue, a parent in another repository) SHALL exit `failed`
carrying its cause and change nothing, and `--unblock` of a blocker the task does not have SHALL
exit `failed` naming both numbers. Body text SHALL reach GitHub as a file or stdin, never as an
argument. Every create SHALL print the new number and URL.

#### Scenario: A feature is created

- **WHEN** `feature "Report export" --intent intent.md` runs
- **THEN** an issue of kind Feature exists with the file's text as body and Status Todo

#### Scenario: A task under a feature, after another

- **WHEN** `add "Write the writer" --feature 3 --after 5 --spec add-writer` runs
- **THEN** a Task exists as a sub-issue of 3, blocked by 5, labelled `change:add-writer`

#### Scenario: Order added then lifted

- **WHEN** `edit 2 --after 1` then `edit 2 --unblock 1` run
- **THEN** after the first 2 is not listed by `ready` and after the second it is

#### Scenario: A refused relation or a closed parent

- **WHEN** `edit 1 --after 2` would make a cycle, or `add --feature 3` names a closed feature
- **THEN** the first exits `failed` carrying GitHub's cause and the second exits `blocked` with
  reason `wrong-status`, and nothing changes

### Requirement: Feedback is an issue of its own type, labelled, abstract, and with no fix

`feedback "<title>" --area <area> --kind <kind> --from <who>` SHALL file an issue of type Feedback
with no parent in the marketplace repository, labelled `area:<area>`, `kind:<kind>` and
`from:<who>`, with `--priority` optional and a body from `--body` or `--body-file` required. The
area SHALL be `marketplace` or a plugin named in the marketplace's
`.claude-plugin/marketplace.json`; the kind SHALL be one of `tool-broken`, `tool-missing`,
`wrong-output`, `guidance` and `agent-mistake`; who SHALL be one of `user`, `main-agent` and
`subagent`. The body SHALL hold the sections `## What happened` (the abstract steps that led to it)
and `## Expected behaviour` (how it should behave), MAY hold `## Context`, and SHALL hold no other
`##` heading. A value outside these sets, a missing section or another heading SHALL exit `usage`
before any call. The title and body SHALL then be refused with `blocked` and reason `private-data`,
naming the kind of match and its line but never the matched text, when they hold an absolute path
under a home directory (`/home/`, `/Users/`, `~/`), the caller's OS login, the machine's hostname,
an email address, or a shape of root `lib/secret-shapes.ts`. When an open Feedback issue has the
same title, the body SHALL become a comment on it and its labels SHALL stay; otherwise the issue
SHALL be created, the label `area:` created on first use. The rules SHALL live in one module,
`lib/feedback.ts`. A repository without the issue type Feedback SHALL exit `missing` with reason
`no-feedback-type` and `next` `qsm-tasks setup`.

#### Scenario: Feedback is filed

- **WHEN** a subagent runs `feedback "qsm-web: searxng hangs on a suspended engine" --area qsm-web
  --kind tool-broken --from subagent` with the two sections in the body
- **THEN** an issue of type Feedback with no parent exists in the marketplace repository with the
  labels `area:qsm-web`, `kind:tool-broken` and `from:subagent` and the body unchanged

#### Scenario: A refused feedback

- **WHEN** the body holds `/home/<login>/x`, an email address or a token shape, or the heading
  `## Suggested fix`, or `--area` names no plugin
- **THEN** the first exits `blocked` with reason `private-data` naming the kind and line but not the
  text, the others exit `usage`, and nothing is posted

### Requirement: One Status field and the flow table are data the verbs read

The plugin SHALL hold the flow in `lib/flow.ts` as data: the Status options Todo, In Dev, Agent
Review, Human Review, Ready For Test, In Test, Blocked and Done, the kinds that use each, one
definition per kind, the Priority options P0, P1 and P2, each verb's guard and effect, and the rule
that derives a feature's Status. The verbs, `flow`, `doctor`, `setup` and the tests SHALL read that
table and no other copy of a name or a definition SHALL exist in the binary, apart from the Action's
workflow file, which `doctor` checks against it. The definitions SHALL be these:

| Status | Task and Bug | Feature | Feedback |
| --- | --- | --- | --- |
| Todo | Not started | Being planned: intent, acceptance criteria, specs, tasks | Filed, not yet read |
| In Dev | Claimed and being built | Its tasks are being built | not used |
| Agent Review | PR open: CI, the gates and the review agents run; every finding is fixed | not used | not used |
| Human Review | CI green and no open finding: the owner tests it and approves | not used | not used |
| Ready For Test | not used | Every task is closed: waiting for the QA agent | not used |
| In Test | not used | The QA agent tests the whole against the business request on the real path, then the owner accepts | not used |
| Blocked | not used | QA found a finding: a fix task is open under the feature | not used |
| Done | Merged into main with Closes #N, CI green, every finding fixed, approved by the owner | Every task done, every acceptance criterion shown on the real path with no open finding, accepted by the owner | Read and settled: answered, changed or filed as a task |

| Priority | Definition |
| --- | --- |
| P0 | Breaks something in use or blocks the work in hand: next |
| P1 | Needed for the current feature |
| P2 | Worth doing, no date |

A close as not planned SHALL write no Status: "Item closed" sets Done, and the close reason
separates it from a close as completed. `flow` SHALL print the table, both definitions of done and
each verb's guard and effect. A value that is not an option SHALL exit `usage` listing the options
of its field before any backend call, and a verb that would write a Status its kind does not use
SHALL exit `blocked` with reason `wrong-kind`, because the views filter by kind and Status.

#### Scenario: The flow is printed

- **WHEN** `qsm-tasks flow` runs
- **THEN** it prints the Status options of each kind, both definitions of done and each verb's
  guard and effect, byte-identical to the table in `lib/flow.ts`

#### Scenario: A Status that is not an option, or not the kind's

- **WHEN** `list --status Reviewing` runs, `list --kind task --status Blocked` runs, or a verb would
  set a task to In Test
- **THEN** the first two exit `usage` listing the names, the third exits `blocked` with reason
  `wrong-kind`, and nothing is written

### Requirement: Task and feedback verbs move one item by its guard

The verbs below SHALL move an item only from the state they need, and SHALL refuse any other kind
with `wrong-kind` and any other state with `wrong-status`, naming the current value and changing
nothing. A Feedback issue SHALL take `close` and `reopen` only, and a feature SHALL take `plan`,
`qa`, `accept` and `close --not-planned` only.

| Verb | Needs | Effect |
| --- | --- | --- |
| `claim <n>` (task, bug) | Todo (an item not yet on the board counts as Todo), unassigned or held by the caller | In Dev, assignee the caller, on the board; its feature at Todo goes to In Dev |
| `unclaim <n>` | In Dev, Agent Review or Human Review, or Todo with the label `deferred` | Todo, unassigned, label `deferred` removed |
| `unclaim <n> --until <v>` | Todo or In Dev | Todo, unassigned, label `deferred`, comment `Deferred until <v>` |
| `review <n>` | In Dev or Human Review | Agent Review |
| `human <n>` | Agent Review | Human Review |
| `close <n> --reason "<text>"` (task, bug, Feedback) | open | closed as completed, the reason as a comment |
| `close <n> --not-planned --reason "<text>"` (also a feature) | open, a feature with no open sub-issue | closed as not planned, the reason as a comment |
| `reopen <n>` (task, bug, Feedback) | closed, and not under a closed feature | open, Todo |

`claim` held by another login SHALL exit `blocked` with reason `held` naming it, and a repeat claim
by the holder SHALL change nothing. No verb SHALL write Done, and a close SHALL write no Status.

#### Scenario: A task is claimed

- **WHEN** `claim` runs on an open unassigned Todo task whose feature is Todo
- **THEN** the task has the caller as assignee and Status In Dev, its feature is In Dev, and a
  repeat claim by the caller changes nothing

#### Scenario: Held by someone else

- **WHEN** `claim` runs on a task assigned to another login
- **THEN** it exits `blocked` with reason `held` naming that login and changes nothing

#### Scenario: A skipped step or a wrong kind

- **WHEN** `human` runs on a task In Dev, or `claim` runs on a Feature or a Feedback issue
- **THEN** the first exits `blocked` with reason `wrong-status` naming In Dev and Agent Review, the
  second with reason `wrong-kind`, and nothing changes

#### Scenario: A task is given back, or deferred and brought back

- **WHEN** `unclaim --until 2026-12-01` runs on a task In Dev, then later `unclaim` on it
- **THEN** after the first `ready` does not list it, it is Todo and unassigned and its last comment
  says `Deferred until 2026-12-01`, and after the second the label is gone and `ready` lists it

#### Scenario: Close without a pull request, and not planned

- **WHEN** `close 9 --reason "decided: keep the table"` and `close 10 --not-planned --reason
  "superseded by 12"` run on open tasks, and `close` runs without `--reason`
- **THEN** 9 is closed as completed and 10 as not planned, each with its comment and no Status
  written by the verb, and the third exits `usage`

### Requirement: A feature's Status is derived, and the Action is its only writer

The only verb write to a feature's Status SHALL be `claim` of one of its tasks (Todo to In Dev),
`plan` (to Todo) and `qa` (to In Test), and `accept` closes it. Every other change SHALL be made by
one rule, held once in `lib/flow.ts` and repeated by the Action: a feature at Todo stays there until
`claim` of a child moves it to In Dev, or a child closes, which moves it to In Dev at once; then, by
the stored Status, an open sub-issue SHALL send Ready For Test to In Dev and In Test to Blocked, and
the closing of the last open sub-issue (at least one closed) SHALL send In Dev or Blocked to Ready
For Test; any other Status SHALL stay. A workflow file in this repository,
`.github/workflows/feature-ready.yml`, SHALL apply the rule when an issue is opened, closed or
reopened and its parent is a Feature. It SHALL use `gh` only, authenticate with the repository
secret `PROJECT_TOKEN`, change no other field, post nothing and serialise two events under one
parent. A verb that adds a sub-issue to an existing issue (`edit --feature`) SHALL NOT recompute the
feature: its Status MAY lag until the next event on a child, and the guards of `qa` and `accept`
SHALL read the sub-issues, never the Status alone.

#### Scenario: The last task closes

- **WHEN** the last open sub-issue of a feature at In Dev closes
- **THEN** the feature's Status becomes Ready For Test within a minute, and while another is open it
  is unchanged

#### Scenario: A feature of decision tasks

- **WHEN** a task of a feature at Todo is closed by `close` without ever being claimed
- **THEN** the feature goes to In Dev and, with no sub-issue open, to Ready For Test

#### Scenario: A finding under test

- **WHEN** QA runs `add --feature 3 "export drops the last row"` on a feature In Test
- **THEN** a Task exists under feature 3 and the Action sets Blocked, and when that task closes the
  Action sets Ready For Test

#### Scenario: A task added or reopened under a feature that waits

- **WHEN** an open sub-issue appears under a feature at Ready For Test
- **THEN** the Action sets In Dev, and under a feature at Blocked or In Dev it changes nothing

### Requirement: Feature verbs plan, test and accept

`plan <feature>` SHALL need In Dev, Ready For Test or Blocked and set Todo. `qa <feature>` SHALL
need a feature stored at In Dev, Ready For Test or Blocked with no open sub-issue and at least one
closed, so QA never waits for the Action, and set In Test; it SHALL exit `blocked` with reason
`wrong-status` naming the open sub-issues or the current Status otherwise. `accept <feature>` SHALL
need In Test and no open sub-issue and close the feature as completed, writing no Status, because
the board's "Item closed" workflow sets Done. QA SHALL file a defect, and the owner a rejection, as
`add --feature <n> "<reason>"` under the feature In Test; no verb for it exists.

#### Scenario: QA takes a feature, before or after the Action ran

- **WHEN** `qa` runs on a feature at Ready For Test, or at In Dev with every sub-issue closed
- **THEN** its Status is In Test

#### Scenario: QA before the work is done, and accept before QA

- **WHEN** `qa` runs on a feature at Todo or In Dev with an open sub-issue, and `accept` on one at
  Ready For Test
- **THEN** each exits `blocked` with reason `wrong-status` naming why, and the feature is unchanged

#### Scenario: The owner accepts

- **WHEN** `accept 3` runs on a feature In Test with no open sub-issue
- **THEN** the issue is closed as completed, the verb writes no Status, and the board shows Done

### Requirement: Done is GitHub's

A merged pull request whose body says `Closes #N` SHALL close task N, and the board's built-in
workflow "Item closed" SHALL set Done for it and for a feature closed by `accept`, not a verb. The
board SHALL have these built-in workflows switched on: "Auto-add to project", "Auto-add sub-issues
to project", "Item added to project" (sets Todo), "Item closed" (sets Done), "Pull request merged"
(sets Done) and "Pull request linked to issue" (sets Agent Review). The last moves a task to Agent
Review when its pull request is linked, and `review` stays the verb for the same move and for the
way back from Human Review.

#### Scenario: A pull request is merged into a protected main

- **WHEN** a pull request with `Closes #N` merges into the default branch and N is a task on the
  board
- **THEN** N is closed and `show N` prints Status Done

### Requirement: Only lib/github talks to GitHub

Only the module `lib/github/` SHALL name `gh`, a node id, an issue type, a project field or a
GraphQL query, and it SHALL reach `gh` through one `Run(args, stdin)` function. Verbs and
`lib/flow.ts` SHALL see only plain items and values.

#### Scenario: A verb is tested without GitHub

- **WHEN** a flow test runs the built binary with a recording fake `gh` on `PATH`
- **THEN** it asserts the calls `gh` received, and any verb's output holds no node id, field id or
  option id

### Requirement: doctor checks every part of the task tool and names each fix

`qsm-tasks doctor` SHALL print one line per check with `ok`, `failed` or `manual`, and exit `ok`
when every check is `ok`, `partial` when only `manual` ones remain, and `missing` or `failed` with
the cause otherwise. It SHALL check: `gh` on PATH with a login and the `project` scope; the
repository and the one linked board; the issue types Feature, Task, Bug and Feedback; the fields
Status and Priority with exactly the option names of the flow table (names only; an extra or wrongly
named option, such as a leftover In Progress, or a leftover field `Epic stage`, is `failed` with the
web-UI page as its fix, never `setup`); the labels `deferred`, `kind:*` and `from:*`; the built-in
workflows that must be on (the list of "Done is GitHub's"); the views Tasks and Features; the file
`.github/workflows/feature-ready.yml` with names that are options of the board; and the secret
`PROJECT_TOKEN`. Each failing line SHALL name its fix. A check the backend cannot read SHALL be
`manual` and SHALL NOT be reported `ok`.

#### Scenario: Everything is set, or an option is missing

- **WHEN** every part is in place, or the board has no Status option In Test
- **THEN** the first exits `ok`, the second prints that line `failed` naming `qsm-tasks setup`

#### Scenario: A leftover

- **WHEN** the board still has a field `Epic stage` or a Status option In Progress, or "Item closed"
  is off
- **THEN** each line is `failed` and names the project's web-UI page, and `setup` is not named

#### Scenario: gh is missing

- **WHEN** `gh` is not on PATH
- **THEN** `doctor` exits `missing` with reason `no-gh` and no other check runs

### Requirement: setup creates what the API allows and names the rest

`qsm-tasks setup` SHALL, for a repository and its board, create what the API allows and nothing
else: the fields Status and Priority with every missing option and its definition from the flow
table, the issue type Feedback when it is missing, and the labels `deferred`, `kind:*` and `from:*`.
It SHALL NOT create, rename or delete GitHub's default issue types, and SHALL NOT rename, reorder or
delete an option. A second run SHALL do nothing and say so, and `setup` SHALL print what it cannot
create (the views, the built-in workflows, the secret, the Action file) as the lines `doctor` prints
for them.

#### Scenario: A new board, run twice

- **WHEN** `setup` runs against a board with no fields, then again
- **THEN** the first creates both fields with all options and definitions and prints the views,
  workflows and secret as `manual`, and the second creates nothing and says so

### Requirement: The tool posts what it is given and nothing of its own

A verb SHALL write to an issue only the text and labels its caller passed, apart from the two fixed
texts of the binary, the label `deferred` and the comment `Deferred until <value>`, and SHALL add no
footer, marker, trailer or signature of its own. The labels the binary writes SHALL be `deferred`,
`change:<id>`, and the `area:`, `kind:` and `from:` labels of `feedback`.

#### Scenario: A comment

- **WHEN** `note 12 "measured: 40 ms"` runs
- **THEN** the posted comment is exactly that text

### Requirement: Install compiles and links the binary

`scripts/install.ts` SHALL be one `installScript(import.meta)` call of `lib/install-base.ts`: it
compiles `qsm-tasks`, links it onto the user's PATH and writes its completions, and a second run
SHALL change nothing. `gh` SHALL be a prerequisite reported by `qsm-tasks doctor`, never installed
by the plugin.

#### Scenario: Installed on a clean machine

- **WHEN** `qsm-setup install qsm-tasks` runs
- **THEN** `qsm-tasks --help` lists the verbs of this spec and a second install changes nothing

## MODIFIED Requirements

### Requirement: Dependencies

The plugin SHALL declare no plug-in in `dependencies`: the binary imports root `lib/` and itself
only, reads no other plugin's file and calls no other plugin's verb, and the core works alone. Its
one prerequisite is the `gh` command on PATH with a login that has the `project` scope, checked by
`qsm-tasks doctor`; without it every verb exits `missing` naming `gh` and has no second route.

#### Scenario: Installed alone

- **WHEN** only qsm-tasks is installed in a session
- **THEN** the `task-tool` skill loads and every verb it names runs with `gh` logged in, and the
  session needs no other plugin

#### Scenario: gh is missing for doctor

- **WHEN** a verb runs with `gh` not on PATH
- **THEN** it exits `missing` naming `gh` and does nothing else

## REMOVED Requirements

### Requirement: Install puts br on the machine or says how

**Reason**: The install now compiles and links `qsm-tasks`; there is no `br` to probe.

**Migration**: `scripts/install.ts` becomes one `installScript(import.meta)` call and the `br` probe
and its test are deleted.

### Requirement: No binary, the install is the doctor

**Reason**: The plugin now ships a binary and a `doctor` verb that checks the whole task tool.

**Migration**: "One binary, qsm-tasks, serves the task port" and "doctor checks every part of the
task tool and names each fix".
