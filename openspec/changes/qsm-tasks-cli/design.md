## Context

The marketplace is a microkernel: a role such as "task" is served by one plugin and used through
its contract, a CLI verb or the noun. `qsm-tasks` serves "task" today with a skill over `br`.
Feature #3 moves the store to GitHub issues and an org board (qsmark-labs, Project #1). Measured on
this repository: the default issue types Feature, Task and Bug; a Status field; a built-in board
column `Sub-issues progress`; eight built-in workflows on (auto-add, auto-add sub-issues, item added
to Todo, item closed to Done, auto-close, PR linked, PR merged, auto-archive). `gh` 2.102.1 JSON
carries `parent`, `subIssues`, `blockedBy`, `blocking`, `issueType`, `subIssuesSummary`;
`gh issue list --search "-is:blocked"` gives the unblocked set in one query; a field is written by
`gh project item-edit` with ids. Those are the backend's business, inside `lib/github/` only. Not on
the board yet: the issue type Feedback, the field Priority and the Status options of the flow table
that the board lacks (decisions 14, 15 and 5); task 0.5 measures what the API can write and the
owner's steps of task 0.6 bring the board to the table. The views Tasks and Features are the
owner's: their filters are set in the web UI.

## Goals / Non-Goals

**Goals:** every step of the task flow is one verb; the agent never composes `gh`, `jq` or GraphQL
for a task; the flow's rules are enforced by the binary, not remembered by the agent; the backend
can be replaced by another plugin serving the same verbs, or extended in this one place.

**Non-Goals:** pull requests, review threads and git (qsm-forge); a second backend; creating views
or built-in workflows (the API cannot); the QA agent; the App bot; the release train (the Status
option Released is only named here); migration of `br` tasks; a hook that forces the verbs (see
Open decisions).

## Decisions

### 1. One plugin, one binary, the verbs are the contract

`plugins/qsm-tasks/qsm.json` declares `qsm.bin` `qsm-tasks`, `qsm.noun` `tasks` and one command per
verb; help, completions and `$.tasks.<verb>()` are generated from it (`find-spec` is `findSpec`).
Logic is in `lib/`; `scripts/cli.ts` only maps `runCli` handlers to it. Install is
`installScript(import.meta)`: compile, link the bin, completions. The plugin imports root `lib/` and
itself only, declares no plug-in dependency, and its one prerequisite is `gh` on PATH with a login
(`missing` otherwise). Reason for a binary rather than a skill over `gh`: the agent's raw route is
the failure this removes, and hooks need `$.tasks`.

### 2. The verbs

| Group | Verbs | Positional and flags |
| --- | --- | --- |
| read | `ready` | `--feature <n>`, `--qa`, `--limit` |
| | `list` | `--feature <n>`, `--kind <feature\|task\|bug\|feedback>`, `--status <Status>`, `--priority <P0\|P1\|P2>`, `--mine`, `--blocked`, `--state open\|closed\|all` (open), `--label`, `--limit` (50) |
| | `show <n>` | |
| | `tree <feature>` | |
| | `search "<words>"` | `--state` (all), `--limit` |
| | `notes <n>` | `--limit` (the last 20) |
| | `board` | |
| create | `feature "<goal>"` | `--intent <file or ->` required: the feature body |
| | `add "<title>"` | `--feature <n>`, `--after <n>`, `--spec <change-id>`, `--priority`, `--body`/`--body-file`, `--label` |
| | `feedback "<title>"` | `--area`, `--kind`, `--from` required, `--priority`, `--body`/`--body-file` required |
| | `finding <feature> "<title>"` | `--body`/`--body-file` |
| edit | `edit <n>` | `--title`, `--priority`, `--body`/`--body-file` |
| | `move <n>` | `--feature <n>` required |
| | `after <n> <blocker>`, `unblock <n> <blocker>` | |
| | `assign <n>` | `--login` (the caller) |
| | `spec <n> <change-id>`, `find-spec <change-id>` | |
| | `note <n> "<text>"` | text or `--body-file` |
| task flow | `claim <n>`, `unclaim <n>`, `review <n>`, `human <n>`, `reopen <n>` | |
| | `close <n>` | `--reason "<what was done>"` required |
| | `drop <n>` | `--reason` required; a task, Feedback, or a feature with no open sub-issue |
| | `defer <n>` | `--until <YYYY-MM-DD or a condition>` required |
| feature flow | `plan <feature>`, `qa <feature>`, `accept <feature>` | |
| admin | `doctor`, `setup`, `flow` | `setup`: `--project owner/number` |

Every verb takes `--repo owner/name` and `--project owner/number` (decision 3) and the harness's
`--json`. That is thirty-three verbs. Names are the flow's words, with these refinements and the
reason for each:

- `list` has `--kind` because a feature and a task share one Status field, so Status alone does not
  say which kind a row is.
- `add --feature` is optional: a loose task (a follow-up, a pen edit from the lens) has no feature
  and is never a feature's child; a spec change always passes it.
- `close` is added (decision of 2026-10-29); `reopen` covers a task; an accepted feature is not
  reopened (`wrong-kind`), new work is a new feature.
- `unclaim` is the way back to the ready list for a task: from In Dev, Agent Review or Human Review,
  or from Todo when the task is deferred; `plan` is the way back to Todo for a feature that is
  re-planned; `feature` already creates at Todo.
- `human` and `review` are the two ends of CI for a task: `review` also takes a task back from Human
  Review when a finding appears. A feature has neither.
- There is no `reject`: the owner's rejection of a feature is a `finding` with the owner's reason as
  title, which is In Test to Blocked with a fix task, the same write.
- `drop` is the one way to Canceled, for a task, a feature and a Feedback issue (decision 17).
- `ready --qa` is a flag, not a verb: the QA agent's list is the ready list of the other kind.

### 3. The repository and the board are resolved, not configured

The repository is `--repo`, else the origin remote of the working directory, else `missing`
(`no-repo`). The board is `--project owner/number`, else the one Projects v2 board linked to the
repository; none or several is `missing`/`usage` naming `--project`. Nothing is stored: a default in
a file is a second source of truth that goes stale when the board moves (it moved once, from a
personal account to the organization). `feedback` is the exception: it always targets the
marketplace repository, taken from the checkout `QSM_MARKETPLACE` points at, because a subagent
runs in other projects (decision 14).

### 4. Reads

`ready` is open, Status Todo, not blocked, not deferred, of kind Task or Bug (never a Feature, never
Feedback), ordered by Priority (P0, P1, P2, then none) and within one priority by ascending number;
one `gh issue list --search "-is:blocked -type:Feature -type:Feedback -label:deferred"` call,
filtered to Status Todo by the backend. `ready --qa` lists open features whose Status is Ready For
Test, and features at In Dev whose sub-issues are all closed, in ascending number; it takes no other
filter. `--mine` on `list` is assigned to the caller's login. `tree` prints the feature, then its
sub-issues indented one level with Status, assignee and blockers, so the QA agent and the owner read
one screen. `board` counts features, tasks (a bug counts as a task) and Feedback issues per Status,
each kind over the options it uses, zero included, in flow order, with Canceled as its own row after
Done and Released. `list` shows open issues by default, so Done, Released and Canceled items appear
only with `--state closed` or `all`. `search` is `gh`'s issue search over title and body, any state,
each row with its kind and state. `notes` prints the comments oldest first, each as `<date> <login>:
<text>`. All output is deterministic: ascending number unless the verb says otherwise, no relative
times, no colour. Output shape in decision 10.

### 5. The flow is a table in `lib/flow.ts`

One module holds the options of the field Status and Priority with their definitions (the text the
board shows and `setup` writes), and for each verb its guard (the field value it needs) and its
effect (the value it writes, the assignee, the side effect on the feature). Status has ten options,
and each kind uses a part of them; the table says which kind takes each option and gives one
definition per kind:

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
| Released | Included in a published release | Included in a published release | not used |
| Canceled | Closed without being done: dropped, duplicate or superseded; the reason is the last comment | Closed without being done: dropped, duplicate or superseded; the reason is the last comment | Closed without being done: dropped, duplicate or superseded; the reason is the last comment |

The board's option description is one string per option, `Task: <text>. Feature: <text>. Feedback:
<text>.`, with the kinds that do not use the option omitted. A verb that would write a Status of the
other kind exits `wrong-kind`.

The verbs' guards and effects: `claim` needs a task at Todo (an item not yet on the board counts as
Todo, because the auto-add workflow may not have run), unassigned or held by the caller; sets In
Dev, assigns the caller, adds the item to the board when it is missing, and moves a feature at Todo
to In Dev. `unclaim` puts a task back on the ready list: it needs a task at In Dev, Agent Review or
Human Review, or at Todo carrying `deferred`; unassigns, Todo, removes `deferred`. `review` needs In
Dev or Human Review; Agent Review. `human` needs Agent Review; Human Review. `reopen` needs a closed
task or Feedback issue; opens it, Todo. `close` needs an open task or Feedback issue, closes it
completed and leaves the board to GitHub (Done on close); for a task it first moves its feature from
Todo to In Dev, so the Action that runs on the close sees In Dev (a feature whose only tasks are
decisions would otherwise stay at Todo for good). `drop` needs an open task, an open Feedback issue,
or an open feature with no open sub-issue (else `open-children`), closes it as not planned with the
reason as a comment and sets Canceled (decision 17); it moves no feature, because a feature whose
tasks were all dropped is re-planned or dropped. `defer` needs a task at Todo or In Dev; unassigns,
Todo, adds the label `deferred` and a comment `Deferred until <value>`. A Feedback issue uses Todo,
Done and Canceled only: every task-flow verb except `close`, `drop` and `reopen` refuses it with
`wrong-kind`. `plan` needs a feature at In Dev or Blocked; Todo. `qa` needs a feature at Ready For
Test, or at In Dev with no open sub-issue; In Test (decision 16). `finding` needs In Test; creates
the fix task, Blocked. `accept` needs In Test and no open sub-issue; closes the feature completed
and writes no Status, because the board's "Item closed" workflow sets Done (decision 8). A verb
whose guard fails exits `blocked`, names the rule and the current value, and changes nothing. One
more rule across verbs, the sub-issue rule: When `add`, `reopen` or `move` puts an open sub-issue
under a feature at Ready For Test or In Test, the feature goes to In Dev; under a feature at Done,
Released or Canceled it is refused with `feature-done`; under a feature at any other Status nothing
changes. Under Blocked it is normal, because `finding` creates the fix task itself and sets Blocked.
Nothing sets Released. The table is data the verbs, `flow`, `doctor`, `setup` and the tests read, so
the names exist once in Typescript (and once in the Action, decision 9).

### 6. Binding a change: the first body line

An issue has no external reference, so the task of a spec change starts its body with
`openspec: <change-id>`. `spec <n> <id>` writes it (replacing an earlier one), `add --spec` writes
it at creation, `find-spec <id>` lists issues in any state whose body starts with that exact line
and keeps only exact matches (`add-x` never matches `add-x-more`) and prints the issue or `none`
(exit `ok`, `data.task` null). `edit --body` keeps an existing binding line when the new body has
none. The search is `gh`'s body search followed by an exact first-line filter; task 0 proves it on
real issues, and if the search misses, the binding becomes the label `change:<id>` inside the same
verbs, with no change to their contract.

### 7. Creates, and the fix task of a finding

`feature` creates an issue of type Feature with the intent file as body and sets Status Todo; `add`
creates a Task, optionally a sub-issue of `--feature` and blocked by `--after`; `feedback` is
decision 14; `finding` creates a Task under the feature and sets Blocked. The owner's rejection is a
`finding` with his reason as the title. Why `finding` creates a task: the Action fires on a close,
so a feature at Blocked with every task closed would wait forever; the fix task is what closes next
and carries the reason. Body text goes to `gh` on stdin (`--body-file -`), never as argv, because a
body holds backticks and quotes.

### 8. Done is GitHub's

A merged pull request with `Closes #N` closes the task (a GitHub rule for the default branch,
protected or not) and the board's "Item closed" workflow sets Done; "Pull request merged" does the
pull request's own item, and "Pull request linked to issue" moves a task to Agent Review, the same
move as `review`, which stays the verb for it and for the way back from Human Review. A feature is
closed by `accept` and the same workflow sets its Done. No verb writes Done for a task or a feature,
and none adds an issue to the board (the two auto-add workflows do, within seconds; `claim` adds the
item itself when it is not there yet, because it may run inside that gap). Reason: GitHub does it on
the server for every merge, including one made in the browser, which no verb of ours would see.
Nothing sets Released in this change (Not in this change, in the proposal).

### 9. The Action moves a feature to Ready For Test

`.github/workflows/feature-ready.yml`, trigger `issues: closed`, one job with `gh` only (no install
on the runner): read the closed issue's parent and type; stop unless the parent is a Feature; read
its `subIssuesSummary`; when completed equals total and its Status is In Dev or Blocked, set Ready
For Test through `gh project item-edit`. A concurrency group per parent keeps two closes from
racing. The token is the repository secret `PROJECT_TOKEN` (a `project`-scope token of the owner
now, the App bot's later), because the workflow's own token cannot write an organization project.
Reasons for the place: GitHub runs only `.github/`, and the trigger is a close the owner or a merge
can make in the browser where no verb runs. Cost: the field and option names appear in the YAML as
well as in `lib/flow.ts`; `doctor` reads the workflow file and reports a name that is not an option
of the board. Whether `subIssuesSummary` is current at the close event is unmeasured; task 0.2 and
the Action proof measure it, and if it lags the workflow counts open sub-issues by search, still
`gh`.

### 10. Output and errors

Text first, one shape each: a list row is `#<n> [<Status>] <title>`, with the priority after the
bracket when set (`#12 [Todo] P1 <title>`), followed by `@<login>` when assigned and
`blocked by #<a>,#<b>` when open blockers exist; a feature row adds `<done>/<total>`; a mutation
prints one line per write, `#<n> <from> -> <to>`, so a side effect on the feature is its own line;
an empty list prints `none`. `show` prints the same fields as labelled lines then the body.
`--json` carries the envelope of `lib/cli-base.ts` with `data` holding the same facts, never a node
or field id, in one `Item` shape, plus for a mutation `changes: [{ number, field, from, to }]`:

```text
{ number, url, title, kind, state, status, priority, assignee, parent, blockedBy, labels,
  subIssues: { total, completed } }
```

Errors are the marketplace's outcome codes with a stable `data.reason`: `usage` (2) before any
backend call for a wrong call; `missing` (4) for `no-gh`, `no-login`, `no-repo`, `no-board`,
`no-feedback-type`, `no-file`; `blocked` (5) for a flow guard (`wrong-status`, `held`,
`feature-done`, `open-children`, `wrong-kind`) and for the feedback rule (`private-data`); `failed`
(1) for a refusal by the backend (`refused`, with its words) or an issue that does not exist
(`not-found`). Every failure names the cause and, when there is one, the one fix as `next`
(`gh auth refresh -s project`, `qsm-tasks setup`). No retry, no second route, no rollback; a
multi-write verb (`claim`, `finding`, `accept`) orders its writes so the most likely refusal comes
first and the feature last, and a failure names the writes already done, so the repeat finishes it:
each write is idempotent.

### 11. `doctor`, `setup`, `flow`

`doctor` checks, one line each with `ok`, `failed` or `manual`: `gh` and its login and the `project`
scope; the repository and the one linked board; the issue types Feature, Task, Bug and Feedback; the
two fields Status and Priority with exactly the option names of `lib/flow.ts` and their definitions
(an extra or wrongly named option, such as a leftover In Progress, is `failed` with the project's
field settings in the web UI as its fix, never `qsm-tasks setup`, because setup never renames or
deletes) and no leftover field named `Epic stage` (a leftover is `failed`, its fix: the owner
deletes the field on the project's Settings page); the label `deferred`; the built-in workflows that
must be on: "Auto-add to project", "Auto-add sub-issues to project", "Item added to project" (sets
Todo), "Item closed" (sets Done), "Pull request merged" (sets Done) and "Pull request linked to
issue" (sets Agent Review); the views Tasks and Features; the file
`.github/workflows/feature-ready.yml` with its names and the secret `PROJECT_TOKEN`. Each failing
line names its fix: a `qsm-tasks setup` or the web-UI page. A check the API cannot read is `manual`,
and `doctor` then exits `partial`. `setup` creates what the API allows and nothing else: the fields,
their options with definitions (a missing option is added to an existing field), the issue type
Feedback when it is missing, the label `deferred`; it never creates, renames or deletes GitHub's
default issue types and never renames, reorders or deletes an option, so a second run does nothing
and names nothing. It prints the manual remainder (views, workflows, secret, and a rename the API
cannot do) as the same lines `doctor` would. `flow` prints the flow, the two definitions of done
and, per verb, its guard and effect, from `lib/flow.ts`.

### 12. The backend boundary

`lib/backend.ts` is a type, `Backend`, in backend-neutral words: read an item, list items by a
filter, create an item, set a field, assign, relate (parent, blocker), comment, close, search,
resolve the board, check the setup. `lib/github/` implements it by `gh` through one `Run` function
(a test hands it a recorded answer), is the only code that names `gh`, a node id, an issue type or
a project field, and is chosen in one place, `lib/backend-for.ts`. Verbs and `lib/flow.ts` import
the type only. Another backend is another implementation of the type, in this plugin; a plugin
that serves the same verbs under its own binary replaces this one for a user, and the skill, which
names the verbs, is what it also replaces.

### 13. Ghost mode

The binary adds nothing of its own to a body, comment, title or label, apart from two fixed texts,
the label `deferred` and the comment `Deferred until <value>` of `defer`: no footer, no marker, no
`Co-Authored-By`. The only labels it writes are `deferred`, the three feedback labels the caller
names (decision 14), and `change:<id>` if decision 6 falls back. `from:main-agent` names an agent on
a public repository by the owner's choice (proposal, decision 2); the binary never adds it unasked.
Commit messages and pull requests are not its business.

### 14. Feedback: an issue type, three labels, fixed sections, no private data

`feedback "<title>" --area <a> --kind <k> --from <f>` files an issue of type Feedback, with no
parent, in the marketplace repository. One module, `lib/feedback.ts`, holds its rules as data:

| Part | Values |
| --- | --- |
| `area:` | `marketplace`, or a plugin named in the marketplace's `.claude-plugin/marketplace.json` |
| `kind:` | `tool-broken`, `tool-missing`, `wrong-output`, `guidance`, `agent-mistake` |
| `from:` | `user`, `main-agent`, `subagent` |
| body sections | `## What happened` (required: the abstract steps that led to it), `## Expected behaviour` (required: how it should behave), `## Context` (optional: the rest) |

The kinds are the four the instruction file names, with the tool split into broken and missing. A
value outside the table, a missing required section, or a `##` heading outside the three exits
`usage` before any call, so "## Suggested fix" is refused by shape. Then the title and body are
checked for personal or system data: an absolute path under a home directory (`/home/`, `/Users/`,
`~/`), the caller's OS login or `gh` login, the machine's hostname, an email address, and the
secret shapes of root `lib/secret-shapes.ts`. A match exits `blocked` with reason `private-data`,
names the kind of match and its line, never the value, and posts nothing. When an open issue of
type Feedback with the same title exists, the body becomes a comment on it (`data.created` false)
and its labels are left as they are; else the issue is created with the three labels, each label
created on first use. No issue type Feedback in the repository is `missing` with reason
`no-feedback-type` and `next` `qsm-tasks setup`. Why a type and not a feature: an inbox never ends,
so as a feature it sits in the Features view with no Status that means anything (proposal,
decision 2).

### 15. Priority

The field Priority has the options P0 (`Breaks something in use or blocks the work in hand: next`),
P1 (`Needed for the current feature`) and P2 (`Worth doing, no date`), held in `lib/flow.ts` beside
Status. `add`, `edit` and `feedback` set it with `--priority`, `list` filters by it, `ready` sorts
by it, and an issue without it sorts last. It has no guard: any kind may carry it.

### 16. Two routes to QA: the owner's exception to one path

A feature reaches In Test by the Action first (Ready For Test, then `qa`) or by `qa` straight from
In Dev when every sub-issue is closed. The owner: "Both should be possible, pref the action." This
is the one place the binary has two routes, by the owner's explicit decision; the rule of one path
is otherwise kept. Why: the Action depends on a secret, a scope and a workflow run that can fail or
lag by a minute, and QA must not wait for it when the work is plainly done; the verb needs only the
same fact the Action reads, that no sub-issue is open. Bounds: the verb refuses In Dev with an open
sub-issue (`open-children`) and any other Status (`wrong-status`); both routes end at In Test with
the same guard, so nothing downstream knows which was taken; `ready --qa` lists both kinds of
waiting feature; the skill names the Action's route as the preferred one.

### 17. Canceled: written by `drop` or by the Action, measured first

`drop <n> --reason` closes an item as not planned, comments the reason and sets Canceled. The
built-in "Item closed" workflow sets Done on every close, so the two may race. Task 0.4 measures
whether Done overwrites the Canceled written by `drop`, and then one of two, never both: if it does
not, `drop` writes Canceled itself; if it does, `drop` writes nothing to Status and the Action of
decision 9, which already runs on `issues: closed`, sets Canceled when the close reason is not
planned (it reads `state_reason`). Either way a dropped item never rests at Done. `board` counts
Canceled items in their own row and nothing in this change archives them.

## Data

None stored. The envelope's `data` is the `Item` shape and `changes` of decision 10.

## Failure behaviour

Decision 10. A repeat of any write verb finds the work done and changes nothing; a `blocked` or
`usage` failure runs no write.

## Proof

Task 0 measures the unknowns on this repository. Each group of verbs then has a real run through
the built binary with `--json` on `qsmark-labs/qsm-marketplace` against Project #1, with issues
titled `test: ...` closed afterwards. One `bun test` through `runBin` with `isolatedEnv` and a
recording fake `gh` proves what a real run cannot: a usage error runs no call, a guard refusal runs
no write, a refused second write of `claim` names the first. The last task runs the whole feature
loop, claim to accept, with the Action.

## Risks / Trade-offs

- `gh` flags change (`--blocked-by`, `--parent` are new): a missing flag fails with `gh`'s message,
  loud; `doctor` names the minimum behaviour, not a version.
- Several writes are not a transaction; repeatability is the repair.
- Offline, nothing works: one path, no cache, no fallback.
- The owner's approval is not machine-checkable (decision in the proposal's critique); status
  guards stop a skipped step, the skill and the reply carry the yes.

## Open decisions

1. **Should a guard hook refuse raw `gh issue`, `gh project` and `gh api` task calls?** The skill
   forbids them. A hook forces it, as forge-guard does for review threads. Recommended yes, in a
   later change once the verbs have run live: a guard before the verbs are proven blocks the only
   way to file an issue. Not done here.
