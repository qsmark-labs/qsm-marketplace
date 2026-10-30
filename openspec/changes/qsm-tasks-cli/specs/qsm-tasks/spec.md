## ADDED Requirements

### Requirement: One binary, qsm-tasks, serves the task port

The plugin SHALL ship one binary `qsm-tasks`, named after the plugin, whose verbs are described in
`qsm.json` and whose noun is `$.tasks`, so a person, a script and a hook reach the same logic: a
hook calls `$.tasks.<verb>()` where a person runs `qsm-tasks <verb>`. The binary SHALL cover every
step of the task flow, from the ready list to the acceptance of a feature, so that no step needs a
raw `gh`, `jq` or GraphQL call. The binary SHALL NOT touch pull requests, review threads or git
state. Its verbs SHALL be: `ready`, `list`, `show`, `tree`, `search`, `notes`, `board`, `feature`,
`add`, `feedback`, `finding`, `edit`, `move`, `after`, `unblock`, `assign`, `spec`, `find-spec`,
`note`, `claim`, `unclaim`, `review`, `human`, `reopen`, `close`, `drop`, `defer`, `plan`, `qa`,
`accept`, `doctor`, `setup` and `flow`.

#### Scenario: A step of the flow needs a task operation

- **WHEN** an agent has to create a sub-issue, order two tasks, claim a task or move a feature to a
  Status
- **THEN** one `qsm-tasks` verb does it, and the agent composes no backend call

#### Scenario: A gap is found

- **WHEN** a step of the flow has no verb
- **THEN** the binary gains the verb and its scenario in `qsm.json` and this spec, and no skill
  tells the agent to call a raw API

#### Scenario: A hook calls the same logic

- **WHEN** a hook calls `$.tasks.ready({ feature: 12 })`
- **THEN** it gets the `data` the shell's `qsm-tasks ready --feature 12 --json` prints

### Requirement: Every verb prints deterministic text and the standard envelope

Every verb SHALL print text an agent reads without parsing and, with `--json`, the envelope of
`lib/cli-base.ts` whose `data` carries the same facts. A list row SHALL be
`#<n> [<Status>] <title>`, with the Priority after the bracket when set, followed by
`@<login>` when assigned and by the text `blocked by` and the open blockers' numbers when any exist,
and a feature row SHALL add its done and total sub-issue counts as `done/total`. A list SHALL be in
ascending issue number unless the verb says otherwise, and an empty list SHALL print `none`. A write
verb SHALL print one line per write, `#<n> <from> -> <to>`, so a side effect on a feature is its own
line. The `data` of an item SHALL hold `number`, `url`, `title`, `kind`, `state`, `status`,
`priority`, `assignee`, `parent`, `blockedBy`, `labels` and `subIssues: { total, completed }`,
and a write verb's `data` SHALL add `changes: [{ number, field, from, to }]`. No output SHALL carry
a node id, a field id, an option id or a backend's own shape. Output SHALL carry no colour, no
relative time and no emoji.

#### Scenario: The same call twice

- **WHEN** a list verb runs twice and nothing changed
- **THEN** both outputs are byte-identical

#### Scenario: A write that touches two issues

- **WHEN** `claim` moves a task to In Dev and its feature from Todo to In Dev
- **THEN** two lines print, `#12 Todo -> In Dev` and `#3 Todo -> In Dev`, and `changes`
  holds both

#### Scenario: Nothing matches

- **WHEN** `ready` finds no task
- **THEN** it prints `none`, exits `ok` and `data.items` is empty

### Requirement: A failure is a typed outcome with a reason, and nothing else runs

Every verb SHALL fail with one of the marketplace's outcome codes and a stable `data.reason`, naming
the cause and, when there is one, the single fix as `next`. A wrong call SHALL exit `usage` (2)
before any backend call. An absent prerequisite SHALL exit `missing` (4) with reason `no-gh`,
`no-login`, `no-repo`, `no-board`, `no-feedback-type` or `no-file`. A flow rule refusing the move
SHALL exit `blocked` (5) with reason `wrong-status`, `held`, `feature-done`, `open-children` or
`wrong-kind`, naming the rule and the current value, and the feedback rule refusing personal or
system data SHALL exit `blocked` with reason `private-data`. A refusal by the backend or an issue
that does not exist SHALL exit `failed` (1) with reason `refused` carrying the backend's words, or
`not-found`. A verb SHALL NOT retry, take a second route, roll back or continue after a refusal, and
SHALL introduce no outcome code beyond the marketplace's. A verb of several writes SHALL order them
so the likeliest refusal is first and a feature's write last, SHALL make each write idempotent, and
a failure SHALL name the writes already done so a repeat finishes the work.

#### Scenario: A wrong call runs nothing

- **WHEN** a verb is called with an unknown flag, a missing required argument or a value outside its
  choices
- **THEN** it exits `usage` and the recorded backend calls are empty

#### Scenario: The token lacks the project scope

- **WHEN** the login has no `project` scope
- **THEN** the verb exits `failed` with reason `refused`, the backend's words in the message and
  `next` set to `gh auth refresh -s project`, and nothing is created another way

#### Scenario: No repository

- **WHEN** a verb runs with no `--repo` outside a git checkout
- **THEN** it exits `missing` with reason `no-repo` and does not guess one

#### Scenario: A second write is refused

- **WHEN** the board write of `claim` succeeded and the assignment is then refused
- **THEN** the verb exits `failed` naming the write done and the refusal, and running it again
  completes the claim

### Requirement: The repository and the board are resolved, not configured

A verb SHALL act on the repository named by `--repo owner/name`, else on the origin remote of the
working directory. It SHALL act on the board named by `--project owner/number`, else on the one
Projects v2 board linked to the repository; no linked board SHALL exit `missing` with reason
`no-board` and several SHALL exit `usage` naming `--project`. The binary SHALL store no default for
either. `feedback` SHALL always act on the marketplace repository, taken from the checkout that
`QSM_MARKETPLACE` names, whatever the working directory.

#### Scenario: Inside the repository

- **WHEN** a verb runs in a checkout whose origin is `qsmark-labs/qsm-marketplace`
- **THEN** it acts on that repository and on Project #1, the one board linked to it

#### Scenario: The board moves

- **WHEN** the repository is linked to a different board
- **THEN** the verbs act on that board with no file edited

#### Scenario: Feedback from another project

- **WHEN** a subagent runs `feedback` in a checkout that is not the marketplace
- **THEN** the issue is made in the marketplace repository

### Requirement: Read verbs

`ready` SHALL list open issues of kind Task or Bug whose Status is Todo, that no open issue blocks
and that do not carry the label `deferred`, never a Feature and never Feedback, optionally under
`--feature <n>`, ordered by Priority (P0, P1, P2, then none) and within one priority by ascending
number. `ready --qa` SHALL list open features whose Status is Ready For Test and open features whose
Status is In Dev and whose sub-issues are all closed, in ascending number, and SHALL take no
`--feature`. `list` SHALL list issues by `--feature`, `--kind` (`feature`, `task`, `bug` or
`feedback`), `--status` (a Status), `--priority`, `--mine` (assigned to the caller), `--blocked`,
`--label` and `--state` (open by default), up to `--limit`. `show <n>` SHALL print an item's facts,
blockers, sub-issue counts and body. `tree <feature>` SHALL print the feature and its sub-issues one
level below with Status, assignee and blockers. `search "<words>"` SHALL search title and body in
any state and print each row with its kind and state. `notes <n>` SHALL print the comments oldest
first as `<date> <login>: <text>`, at most `--limit`. `board` SHALL print the count of features and
the count of tasks (a bug counts as a task) per Status, each kind over the options it uses, zero
included, in flow order, with Canceled as its own row. A list that reaches its limit SHALL say it is
cut, as a warning, and still exit `ok`.

#### Scenario: A blocked task is not ready

- **WHEN** task 2 is blocked by open task 1 and `ready` runs
- **THEN** task 1 is listed and task 2 is not

#### Scenario: A closed blocker no longer blocks

- **WHEN** task 2 was blocked by task 1 and task 1 is closed
- **THEN** task 2 is listed

#### Scenario: A feature, a claimed task and a deferred task are not ready

- **WHEN** an open feature with no blocker, a task In Dev and a task labelled `deferred` exist
- **THEN** none of them is listed by `ready`, and the open Todo tasks and bugs of the feature are

#### Scenario: P0 comes first

- **WHEN** ready tasks 4 (P2), 7 (P0), 9 (no priority) and 11 (P0) exist
- **THEN** `ready` lists 7, 11, 4, 9

#### Scenario: The QA agent's list

- **WHEN** feature 3 is at Ready For Test, feature 5 is In Dev with every sub-issue closed and
  feature 8 is In Dev with one open sub-issue
- **THEN** `ready --qa` lists 3 and 5, and not 8

#### Scenario: The feature at a glance

- **WHEN** `tree` runs on a feature with three tasks, one done
- **THEN** it prints the feature's Status and `1/3`, then each task with Status, assignee and
  blockers

#### Scenario: Counts per Status

- **WHEN** `board` runs
- **THEN** the features are counted over Todo, In Dev, Ready For Test, In Test, Blocked, Done,
  Released and Canceled, and the tasks over Todo, In Dev, Agent Review, Human Review, Done, Released
  and Canceled, each with its count, including zero

#### Scenario: A bigger list than the limit

- **WHEN** more issues match than `--limit`
- **THEN** `limit` rows print, a warning says the list is cut, and the exit is `ok`

### Requirement: Create verbs

`feature "<goal>" --intent <file or ->` SHALL create an issue of kind Feature whose body is the
intent and SHALL set its Status to Todo. `add "<title>"` SHALL create a Task, optionally a sub-issue
of `--feature`, blocked by `--after`, bound to a change by `--spec`, with `--priority`, `--body` or
`--body-file` and `--label`; it SHALL send a feature at Ready For Test or In Test back to In Dev,
SHALL leave a feature at Blocked as it is and SHALL refuse a feature at Done, Released or Canceled
with reason `feature-done`. `finding <feature> "<title>"` SHALL create a Task under a feature In
Test and set the feature to Blocked. Body text SHALL reach the backend as a file or stdin, never as
an argument. Every create SHALL print the new number and URL.

#### Scenario: A feature is created

- **WHEN** `feature "Report export" --intent intent.md` runs
- **THEN** an issue of kind Feature exists with the file's text as body and Status Todo

#### Scenario: A task under a feature, after another

- **WHEN** `add "Write the writer" --feature 3 --after 5 --spec add-writer` runs
- **THEN** a Task exists as a sub-issue of 3, blocked by 5, whose body starts with
  `openspec: add-writer`

#### Scenario: A body with backticks

- **WHEN** a body holds backticks, quotes and a dollar sign
- **THEN** the issue body is that text unchanged

#### Scenario: A task added to a feature that was ready for test

- **WHEN** `add --feature` names a feature at Ready For Test
- **THEN** the task is created and the feature's Status becomes In Dev, as two lines of output

#### Scenario: A task added to a blocked feature

- **WHEN** `add --feature` names a feature at Blocked
- **THEN** the task is created and the feature stays Blocked

#### Scenario: A task added to a closed feature

- **WHEN** `add --feature` names a feature at Done
- **THEN** it exits `blocked` with reason `feature-done` and creates nothing

#### Scenario: Both body sources or none of a title

- **WHEN** a create verb gets both `--body` and `--body-file`, or no title
- **THEN** it exits `usage` and creates nothing

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
before any backend call. The title and body SHALL then be refused with `blocked` and reason
`private-data`, naming the kind of match and its line but never the matched text, when they hold
an absolute path under a home directory (`/home/`, `/Users/`, `~/`), the caller's OS login or
`gh` login, the machine's hostname, an email address, or a shape of root `lib/secret-shapes.ts`.
When an open issue of type Feedback already has the same title, the body SHALL become a comment on
it and its labels SHALL stay as they are; otherwise the issue SHALL be created, with each missing
label created first. The rules SHALL live in one module, `lib/feedback.ts`. A repository without
the issue type Feedback SHALL exit `missing` with reason `no-feedback-type` and `next`
`qsm-tasks setup`.

#### Scenario: Feedback is filed

- **WHEN** a subagent runs `feedback "qsm-web: searxng hangs on a suspended engine" --area qsm-web
  --kind tool-broken --from subagent` with a body of what happened and the expected behaviour
- **THEN** an issue of type Feedback with no parent exists in the marketplace repository with the
  labels `area:qsm-web`, `kind:tool-broken` and `from:subagent` and the body unchanged

#### Scenario: Feedback already filed

- **WHEN** `feedback` runs with a title an open Feedback issue already has
- **THEN** the body is added as a comment on it, no issue is created and `data.created` is false

#### Scenario: Personal data in the body

- **WHEN** the body holds `/home/<login>/Projects/x`, an email address or a token shape
- **THEN** `feedback` exits `blocked` with reason `private-data`, names the kind and line of each
  match without printing it, and nothing is posted

#### Scenario: A suggested fix

- **WHEN** the body holds the heading `## Suggested fix`
- **THEN** `feedback` exits `usage` naming the three allowed headings and calls nothing

#### Scenario: An area that is not a plugin

- **WHEN** `--area qsm-task` names no plugin of the marketplace
- **THEN** `feedback` exits `usage` and lists no labels created

#### Scenario: No Feedback type

- **WHEN** the marketplace repository has no issue type Feedback
- **THEN** `feedback` exits `missing` with reason `no-feedback-type` and `next` set to
  `qsm-tasks setup`

### Requirement: Edit verbs

`edit <n>` SHALL change `--title`, `--priority` and `--body` or `--body-file` and keep an existing
`openspec: <change-id>` first body line when the new body has none. `move <n> --feature <m>` SHALL
make the task a sub-issue of feature m, leaving an earlier parent. `after <n> <blocker>` SHALL
record that n is blocked by the blocker and `unblock <n> <blocker>` SHALL lift it. `assign <n>`
SHALL assign the caller, or `--login`, without changing Status. `spec <n> <change-id>` SHALL write
the first body line `openspec: <change-id>`, replacing an earlier one. `find-spec <change-id>` SHALL
print the one issue, in any state, whose first body line is exactly `openspec: <change-id>`, or
`none`, and SHALL never match a longer id that begins with it. `note <n> "<text>"` SHALL add one
comment with the text unchanged. A relation the backend refuses (a cycle, a missing issue, a parent
in another repository) SHALL exit `failed` carrying its cause and change nothing; `unblock` of a
blocker the task does not have SHALL exit `failed` naming both numbers.

#### Scenario: The binding is exact

- **WHEN** issues bound to `add-x` and `add-x-more` exist and `find-spec add-x` runs
- **THEN** only the issue bound to `add-x` is printed

#### Scenario: An unbound change

- **WHEN** no issue carries the line
- **THEN** `find-spec` prints `none`, exits `ok` and `data.task` is null

#### Scenario: A body edit keeps the binding

- **WHEN** `edit --body` replaces the body of a task bound to `add-x` with text that does not start
  with the binding
- **THEN** the body starts with `openspec: add-x` followed by the new text

#### Scenario: Order added then lifted

- **WHEN** `after 2 1` then `unblock 2 1` run
- **THEN** after the first 2 is not listed by `ready` and after the second it is

#### Scenario: A dependency cycle

- **WHEN** `after 1 2` runs while 2 is blocked by 1
- **THEN** it exits `failed` carrying the backend's cause and changes nothing

#### Scenario: Removing a dependency that is not there

- **WHEN** `unblock 2 9` runs and 2 is not blocked by 9
- **THEN** it exits `failed` naming 2 and 9 rather than report a removal

#### Scenario: A comment is posted

- **WHEN** `note 12 "measured: 40 ms"` runs
- **THEN** that text is the issue's last comment, unchanged, with no footer

### Requirement: Task flow verbs

A task or a bug SHALL move by Status in this order: Todo, In Dev, Agent Review, Human Review, Done.
`claim <n>` SHALL need Status Todo and an unassigned task or one the caller holds, assign the
caller, set In Dev, add the task to the board when it is not there, and move its feature from Todo
to In Dev; a repeat by the holder SHALL change nothing. `unclaim <n>` SHALL need In Dev, unassign
and set Todo, and SHALL remove the label `deferred`. `review <n>` SHALL need In Dev or Human Review
and set Agent Review. `human <n>` SHALL need Agent Review and set Human Review. `reopen <n>` SHALL
need a closed task, open it and set Todo, and SHALL send a feature at Ready For Test or In Test back
to In Dev. `close <n> --reason "<what was done>"` SHALL close an open task as completed with the
reason as a comment, for work no merge closes. `drop <n> --reason` SHALL close an open task, or an
open feature with no open sub-issue, as not planned with the reason as a comment and set Canceled
(by the verb, or by the Action when the measurement of design decision 17 shows that "Item closed"
would overwrite it; either way never Done), and SHALL exit `blocked` with reason `open-children` for
a feature that has an open sub-issue. `defer <n> --until <date or condition>` SHALL unassign, set
Todo, add the label `deferred` and comment `Deferred until <value>`. No verb SHALL mark a merged
task Done. A verb SHALL refuse a feature where it needs a task, with reason `wrong-kind`, and a move
its guard does not allow, with reason `wrong-status`, naming the current value and changing nothing.

#### Scenario: A task is claimed

- **WHEN** `claim` runs on an open unassigned Todo task whose feature is Todo
- **THEN** the task has the caller as assignee and Status In Dev, and its feature is In Dev

#### Scenario: A later task of a feature in development

- **WHEN** `claim` runs on a task whose feature is already In Dev
- **THEN** the feature is unchanged

#### Scenario: Held by someone else

- **WHEN** `claim` runs on a task assigned to another login
- **THEN** it exits `blocked` with reason `held` naming that login and changes nothing

#### Scenario: The claim is repeated

- **WHEN** the holder claims a task that is already In Dev
- **THEN** it exits `ok` and nothing changes

#### Scenario: A skipped step

- **WHEN** `human` runs on a task In Dev
- **THEN** it exits `blocked` with reason `wrong-status` naming In Dev and Agent Review

#### Scenario: A claim on a feature or a closed issue

- **WHEN** `claim` runs on a Feature or on a closed task
- **THEN** it exits `blocked` with reason `wrong-kind` or `wrong-status` and changes nothing

#### Scenario: A finding on a task in human review

- **WHEN** a review finding appears while the task is Human Review and `review` runs
- **THEN** the task is Agent Review

#### Scenario: A claimed task is given back

- **WHEN** `unclaim` runs on a task In Dev
- **THEN** it is unassigned and Todo

#### Scenario: A task is deferred and comes back

- **WHEN** `defer 14 --until 2026-12-01` runs, then later `unclaim 14`
- **THEN** after the first `ready` does not list 14 and its last comment says `Deferred until
  2026-12-01`, and after the second the label is gone and `ready` lists it

#### Scenario: Close without a pull request

- **WHEN** `close 9 --reason "decided: keep the existing table"` runs on an open task
- **THEN** the task is closed as completed with that comment, and `close` without `--reason` exits
  `usage`

#### Scenario: Not planned

- **WHEN** `drop 9 --reason "superseded by 12"` runs on an open task
- **THEN** the task is closed as not planned with that comment and its Status is Canceled, not Done

#### Scenario: A feature with open tasks is not dropped

- **WHEN** `drop 3 --reason "no longer wanted"` runs on a feature with an open sub-issue
- **THEN** it exits `blocked` with reason `open-children` and changes nothing

### Requirement: Feature flow verbs

A feature SHALL move by Status in this order: Todo, In Dev, Ready For Test, In Test, Blocked, Done.
`plan <feature>` SHALL need In Dev or Blocked and set Todo. `qa <feature>` SHALL need Ready For Test
or In Dev with no open sub-issue, and set In Test; it SHALL exit `blocked` with reason
`open-children` for a feature In Dev with an open sub-issue and with reason `wrong-status` for any
other Status. `finding <feature> "<title>"` SHALL need In Test, create a Task under the feature
whose title is the title, and set Blocked; the owner's rejection of a feature is a `finding`.
`accept <feature>` SHALL need In Test and no open sub-issue and close the feature as completed,
writing no Status, because the board's "Item closed" workflow sets Done. A verb SHALL refuse a task
where it needs a feature, with reason `wrong-kind`, and a refused guard SHALL change nothing. The
binary SHALL close a feature only through `accept` or `drop`.

#### Scenario: QA takes a feature that is ready for test

- **WHEN** a feature is at Ready For Test and `qa` runs
- **THEN** its Status is In Test

#### Scenario: QA takes a feature before the Action ran

- **WHEN** a feature is In Dev with every sub-issue closed and `qa` runs
- **THEN** its Status is In Test

#### Scenario: QA before the work is done

- **WHEN** `qa` runs on a feature at Todo, or at In Dev with an open sub-issue
- **THEN** it exits `blocked` with reason `wrong-status` for the first and `open-children` for the
  second

#### Scenario: QA finds a defect

- **WHEN** `finding 3 "export drops the last row"` runs on a feature In Test
- **THEN** a Task exists under feature 3 and the feature is Blocked, and when that task closes the
  Action sets Ready For Test

#### Scenario: The owner rejects

- **WHEN** `finding 3 "numbers disagree with the invoice"` runs on a feature In Test, on the
  owner's word
- **THEN** a Task with that title exists under the feature and the feature is Blocked, so the
  Action moves it to Ready For Test when that task closes

#### Scenario: The owner accepts

- **WHEN** `accept 3` runs on a feature In Test with no open sub-issue
- **THEN** the issue is closed as completed, no Status is written by the verb, and the board shows
  Done

#### Scenario: Accept before QA

- **WHEN** `accept 3` runs on a feature at Ready For Test
- **THEN** it exits `blocked` with reason `wrong-status` and the feature stays open

#### Scenario: Re-planning

- **WHEN** `plan 3` runs on a feature at In Dev or Blocked
- **THEN** its Status is Todo

#### Scenario: A task verb on a feature

- **WHEN** `human 3` or `review 3` runs on a feature
- **THEN** it exits `blocked` with reason `wrong-kind` and changes nothing

### Requirement: The flow and its definitions are one table the verbs read

The plugin SHALL hold the flow in `lib/flow.ts` as data: the Status options Todo, In Dev, Agent
Review, Human Review, Ready For Test, In Test, Blocked, Done, Released and Canceled, the kind that
uses each (a task and a bug, a feature, or both), one definition per kind, the Priority options P0,
P1 and P2, and for each verb its guard and its effect. The verbs, `flow`, `doctor` and `setup` SHALL
read that table and no other copy of a name or a definition SHALL exist in the binary, apart from
the Action's workflow file, which `doctor` checks against it. The verbs and the board SHALL use the
option names exactly, and the board's description of an option SHALL be the table's text for the
kinds that use it. The definitions SHALL be these:

| Status | Task and Bug | Feature |
| --- | --- | --- |
| Todo | Not started | Being planned: intent, acceptance criteria, specs, tasks |
| In Dev | Claimed and being built | Its tasks are being built |
| Agent Review | PR open: CI, the gates and the review agents run; every finding is fixed | not used |
| Human Review | CI green and no open finding: the owner tests it and approves | not used |
| Ready For Test | not used | Every task is closed: waiting for the QA agent |
| In Test | not used | The QA agent tests the whole against the business request on the real path, then the owner accepts |
| Blocked | not used | QA found a finding: a fix task is open under the feature |
| Done | Definition of done: merged into main with Closes #N, CI green, every finding fixed, approved by the owner | Definition of done: every task done, every acceptance criterion shown on the real path with no open finding, accepted by the owner |
| Released | Included in a published release | Included in a published release |
| Canceled | Closed without being done: dropped, duplicate or superseded; the reason is the last comment | Closed without being done: dropped, duplicate or superseded; the reason is the last comment |

| Priority | Definition |
| --- | --- |
| P0 | Breaks something in use or blocks the work in hand: next |
| P1 | Needed for the current feature |
| P2 | Worth doing, no date |

`flow` SHALL print the flow, both definitions of done and, per verb, its guard and effect, from
that table. A value that is not an option SHALL exit `usage` listing the options of its field before
any backend call. A verb SHALL refuse to write a Status that the item's kind does not use, with
`blocked` and reason `wrong-kind`, and `list` with a `--kind` and a `--status` the kind does not
use SHALL exit `usage` listing that kind's options, because the views filter by kind and Status and
an issue with the wrong one vanishes from its view. Nothing in this change SHALL set Released.

#### Scenario: The flow is printed

- **WHEN** `qsm-tasks flow` runs
- **THEN** it prints the Status order of each kind, both definitions of done and each verb's guard
  and effect, byte-identical to the table in `lib/flow.ts`

#### Scenario: A value that is not an option

- **WHEN** `list --status Reviewing` runs
- **THEN** it exits `usage` listing the Status names and calls nothing

#### Scenario: A Status of the other kind

- **WHEN** `list --kind task --status Blocked` runs, or a verb would set a task to In Test
- **THEN** the first exits `usage` listing the Status names a task uses and the second exits
  `blocked` with reason `wrong-kind`, and nothing is written

#### Scenario: A name drifts on the board

- **WHEN** the board's option is renamed and a verb writes it
- **THEN** the verb exits `failed` with the backend's words, and `doctor` names the option that
  differs from the table

### Requirement: Done is GitHub's, and a feature reaches Ready For Test by an Action

A merged pull request whose body says `Closes #N` SHALL close task N and the board's built-in
workflow "Item closed" SHALL set its Status Done, not a verb; the same workflow SHALL set Done for a
feature closed by `accept`. The board SHALL have the workflows "Auto-add to project", "Auto-add
sub-issues to project", "Item added to project" and "Item closed" switched on. A workflow file in
this repository, `.github/workflows/feature-ready.yml`, SHALL run when an issue closes and SHALL set
the Status of the issue's parent to Ready For Test when the parent is a Feature, no sub-issue of it
is open and its Status is In Dev or Blocked. It SHALL use `gh` only, SHALL authenticate to the
project with the repository secret `PROJECT_TOKEN`, SHALL change no other field, SHALL post nothing
and SHALL serialise two closes under one parent. When the measurement of design decision 17 shows
that "Item closed" overwrites a Canceled written before the close, the workflow SHALL also set
Canceled on an issue closed as not planned and `drop` SHALL write no Status.

#### Scenario: A pull request is merged into a protected main

- **WHEN** a pull request with `Closes #N` merges into the default branch and N is a task on the
  board
- **THEN** N is closed and `show N` prints Status Done

#### Scenario: The last task closes

- **WHEN** the last open sub-issue of a feature at In Dev closes
- **THEN** the feature's Status becomes Ready For Test within a minute

#### Scenario: A task closes while others are open

- **WHEN** a sub-issue closes and another is still open
- **THEN** the feature's Status is unchanged

#### Scenario: A fix task closes under a blocked feature

- **WHEN** the only open sub-issue of a feature at Blocked closes
- **THEN** the feature's Status becomes Ready For Test

#### Scenario: Any other Status

- **WHEN** a sub-issue closes under a feature at Todo, Ready For Test, In Test, Done, Released or
  Canceled
- **THEN** the feature's Status is unchanged

#### Scenario: An issue with no feature

- **WHEN** an issue with no parent, or whose parent is not a Feature, closes
- **THEN** the workflow changes nothing

#### Scenario: The project refuses the token

- **WHEN** the secret is missing or lacks the project scope
- **THEN** the run fails visibly in the Actions tab and the Status stays as it was

### Requirement: The backend is behind one interface

The binary SHALL reach the backend only through the `Backend` type of `lib/backend.ts`, stated in
backend-neutral words, and the GitHub implementation under `lib/github/` SHALL be the only code that
names `gh`, an issue type, a project field, a node id or a GraphQL query. The verbs and the flow
table SHALL import the type only. One place SHALL choose the implementation. Calls to the backend
SHALL go through one `Run` function so a test hands it a recorded answer. A second backend SHALL be
another implementation of the type in this plugin, and a plugin that serves the same verbs under its
own binary SHALL replace this plugin for a user without any consumer changing the verb it calls.

#### Scenario: A verb is tested without GitHub

- **WHEN** a flow test runs a verb against a recording backend
- **THEN** it asserts the writes the backend received and needs no `gh`

#### Scenario: The backend leaks nothing

- **WHEN** any verb prints text or `--json`
- **THEN** no node id, field id, option id or GraphQL shape appears in it

### Requirement: doctor checks every part of the task tool and names each fix

`qsm-tasks doctor` SHALL print one line per check with `ok`, `failed` or `manual`, and exit `ok`
when every check is `ok`, `partial` when only `manual` ones remain, and `missing` or `failed` with
the cause otherwise. It SHALL check: `gh` on PATH, its login and the `project` scope; the
repository and the one linked board; the issue types Feature, Task, Bug and Feedback; the two
fields Status and Priority with exactly the option names and definitions of the flow table, and no
leftover field named `Epic stage`; the label `deferred`; the built-in workflows that must be on;
the views Tasks and Features; the file `.github/workflows/feature-ready.yml` with names that are
options of the board; and the secret `PROJECT_TOKEN`. Each failing line SHALL name its fix: a
`qsm-tasks setup` or the one place in the web UI. A check the backend cannot read SHALL be `manual`
and SHALL NOT be reported `ok`.

#### Scenario: Everything is set

- **WHEN** the board, fields, labels, workflows, views, Action and secret are in place
- **THEN** every line is `ok` and the exit is `ok`

#### Scenario: A field option is missing

- **WHEN** the board has no Status option In Test
- **THEN** that line is `failed`, names `qsm-tasks setup` as the fix, and the exit is `failed`

#### Scenario: A leftover field

- **WHEN** the board still has a field named `Epic stage`
- **THEN** that line is `failed` and its fix is that the owner deletes the field on the project's
  Settings page

#### Scenario: A built-in workflow is off

- **WHEN** "Item closed" is off
- **THEN** that line is `failed` and names the project's Workflows page in the web UI

#### Scenario: gh is missing

- **WHEN** `gh` is not on PATH
- **THEN** `doctor` exits `missing` naming `gh` and no other check runs

### Requirement: setup creates what the API allows and names the rest

`qsm-tasks setup` SHALL, for a repository and its board, create what the API allows and nothing
else: the two single-select fields Status and Priority with every option and its definition from the
flow table (a missing option is added to an existing field), the issue type Feedback when it is
missing, and the label `deferred`. It SHALL NOT create, rename or delete GitHub's default issue
types Feature, Task and Bug, and SHALL NOT rename, reorder or delete an existing option. A second
run SHALL do nothing and say so, and `setup` SHALL print what it cannot create (the views, the
built-in workflows, the secret, the Action file) as the lines `doctor` prints for them.

#### Scenario: A new board

- **WHEN** `setup` runs against a board with no fields
- **THEN** the two fields exist with all options and their definitions, and the lines for the
  views, the workflows and the secret are printed as `manual`

#### Scenario: A board missing some options

- **WHEN** `setup` runs against a board whose Status lacks Ready For Test, In Test, Blocked,
  Released and Canceled
- **THEN** those options are added with their definitions and the existing options are untouched

#### Scenario: The default issue types

- **WHEN** `setup` runs in a repository that has Feature, Task and Bug but not Feedback
- **THEN** only Feedback is created

#### Scenario: Run twice

- **WHEN** `setup` runs a second time
- **THEN** it creates nothing, changes nothing and says everything is in place

### Requirement: The tool posts what it is given and nothing of its own

A verb SHALL write to an issue only the text and labels its caller passed and SHALL add no footer,
marker, trailer or signature of its own. The labels the binary writes SHALL be `deferred`, the
`area:`, `kind:` and `from:` labels the caller of `feedback` names, and, if the binding falls back
to a label, `change:<id>`.

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
