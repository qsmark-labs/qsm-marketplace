## Context

The marketplace is a microkernel: a role such as "task" is served by one plugin and used through
its contract, a CLI verb or the noun. `qsm-tasks` serves "task" today with a skill over `br`.
Feature #3 moves the store to GitHub issues and an org board (qsmark-labs, Project #1). Measured on
this repository: the default issue types Feature, Task and Bug; a Status field; the built-in board
column `Sub-issues progress`; eight built-in workflows on (auto-add, auto-add sub-issues, item added
to Todo, item closed to Done, auto-close, PR linked, PR merged, auto-archive). `gh` 2.102.1 JSON
carries `parent`, `subIssues`, `blockedBy`, `blocking`, `issueType`. Not on the board yet: the issue
type Feedback, the field Priority and the Status options of the flow table that the board lacks.
The views Tasks and Features are the owner's, their filters set in the web UI.

The behaviour is in the spec and is not restated here: this file holds the decisions and their
reasons. The rule behind them is the owner's: "i dont want to duplicate anything that github
already has a way to do normally", and one door for agents: "i like the findings overall, but i
still want my one tasks tool".

## Goals / Non-Goals

**Goals:** every step of the task flow is one verb; the agent never composes `gh`, `jq` or GraphQL
for a task; the flow's rules are enforced by the binary, not remembered by the agent.

**Non-Goals:** pull requests, review threads and git (qsm-forge); a second backend; creating views
or built-in workflows (the API cannot); the QA agent; the App bot; the release train; the migration
of `br` tasks; a hook that forces the verbs (see Open decisions).

## Decisions

### 1. One plugin, one binary, twenty verbs; flags before verbs

`plugins/qsm-tasks/qsm.json` declares `qsm.bin` `qsm-tasks`, `qsm.noun` `tasks` and one command per
verb; help, completions and `$.tasks.<verb>()` are generated from it. Logic is in `lib/`;
`scripts/cli.ts` only maps `runCli` handlers to it; install is `installScript(import.meta)`. The
plugin imports root `lib/` and itself only and needs `gh` on PATH with a login. A verb exists only
for a flow step with its own guard (`claim`, `qa`, `accept`); a read or an edit GitHub already
models is a flag: a tree is `list --feature`, a search is `list --search`, a comment read is `show
--comments`, ordering and assigning are `edit` flags, a deferral is `unclaim --until`, a
cancellation is `close --not-planned`. The board's counts are the web board's, not a verb.
Reason for a binary rather than a skill over `gh`: the agent's raw route is the failure this
removes, and hooks need `$.tasks`.

### 2. The repository and the board are resolved, once per process

The repository is `--repo`, else what `gh` resolves from the working directory; the board is
`--project`, else the one linked board. Field and option ids are read once per process in one
query. Nothing is stored: a default in a file is a second source of truth that goes stale when the
board moves (it moved once, from a personal account to the organization). `feedback` always targets
the marketplace repository, taken from `QSM_MARKETPLACE`, because a subagent runs in other projects.

### 3. Reads are one GraphQL query per verb

`ready`, `list` and `show` read `projectV2.items` once, returning Status, Priority, number, title,
state, type, assignees, `blockedBy` and sub-issue counts, so no verb searches and then looks each
issue up. Reason: a search followed by a lookup per row is N+1 calls on a board of a hundred
issues, and `-is:blocked` filtering is replaced by the `blockedBy` field in the same answer.

### 4. The flow is a table in `lib/flow.ts`

One module holds the Status and Priority options with their definitions per kind, each verb's guard
and effect, and the derivation rule of decision 5 as one function. Everything that names a Status
reads it; the Action YAML repeats the rule, and `doctor` checks the names it uses. Reason: a name
that exists in four places is renamed in three.

### 5. A feature's Status is derived, and the Action is its only writer

A feature's state follows its children, so a verb that writes it by hand is a second writer that can
disagree with the children. The only verb writes are the human acts (`claim` ends planning, `plan`
re-opens it, `qa` starts the test); the rest is one rule applied by an Action on `issues: opened,
closed, reopened`. `qa` takes the same predicate the rule would reach (no open sub-issue), so QA
never waits for the Action: one guard, not two routes. The Action counts the parent's open
sub-issues with one `gh` listing, not `subIssuesSummary`, so its freshness is not a question. Honest
consequence, bounded by the guards: `add --feature` relies on the `opened` event seeing the parent,
and task 0.2 measures it; if it does not, the build stops and this decision and the spec rule are
revised before group 5, with no silent second route. `edit --feature` gives an existing issue a
parent without any event, so the new parent, and the old one (which can sit at In Dev or Blocked
with no open child), keep a Status that lags until the next event on one of their children; `qa` and
`accept` read the sub-issues, so nothing downstream is fooled by the lag. A finding is not a verb:
QA files the fix with `add --feature` under a feature In Test and the rule makes it Blocked. The
Action sits in this repository's `.github/` because GitHub runs only that directory and the trigger
is a close in the browser where no verb runs; its token is a repository secret `PROJECT_TOKEN`
because the workflow's own token cannot write an organization project.

### 6. Cancel is a close, not a Status

GitHub already records why an issue closed (completed or not planned) and shows it as a filter, so
a Status Canceled would be a second copy that a race with "Item closed" could overwrite. `close
--not-planned` writes the close reason and the comment and no Status; "Item closed" sets Done and
the views separate the two by the close reason (the filter syntax is measured in task 0.3). A
Status Released is not added: it returns with the release-train feature.

### 7. A task is bound to its change by a label

`change:<id>` is written by `add --spec` and `edit --spec` and read by `list --spec` as an exact
`label:` search over open and closed issues, one call (a closed task must still be found, or a
second one would be created). The label is created before the issue write, one path, and an id over
GitHub's 50-character label cap is refused as `usage`. Reason: GitHub's label is the field an issue
has for this, filterable and exact, where a first body line needed a search, a filter and a rule to
keep it on every edit.

### 8. Done is GitHub's

A merge with `Closes #N` closes the task and "Item closed" sets Done; `accept` closes a feature and
the same workflow sets its Done. No verb writes Done, and no verb adds an issue to the board (the
auto-add workflows do; `claim` adds the item itself when it is not there yet, because it may run
inside that gap). Reason: GitHub does it on the server for every merge, including one made in the
browser, which no verb of ours would see.

### 9. Output and errors

Text first, one shape each, and `--json` with the same facts and `changes` for a write (spec:
"Output is deterministic text"). Reasons are few so the agent can branch on them: `blocked` has
`wrong-kind`, `wrong-status` (its message names the current Status, the open children or the closed
feature), `held` and `private-data`; `missing` has `no-gh` (no `gh` or no login), `no-repo`,
`no-board`, `no-feedback-type` and `no-file`; `failed` has `refused` and `not-found`. No retry, no
second route, no rollback; a multi-write verb orders its writes so the likeliest refusal comes first
and the feature last, and each write is idempotent, so the repeat finishes it.

### 10. `doctor`, `setup`, `flow`

`doctor` checks option names only, not descriptions: a description is text the owner may edit, a
name is what the verbs and the Action write. An extra or misnamed option is the owner's to fix in
the web UI because `setup` never renames or deletes; `setup` adds what is missing and writes the
definitions when it creates an option, so a second run does nothing. A check the API cannot read is
`manual` and `doctor` exits `partial`, never green on a guess.

### 11. Feedback: an issue type, three labels, fixed sections, no private data

The rules live as data in `lib/feedback.ts`; the table of values is in the spec. Why a type and not
a feature: an inbox never ends, so as a feature it sits in the Features view with no Status that
means anything. The `gh` login is not checked in the body because the login is public on the issue
anyway; the operating-system login, the hostname, home paths, emails and secret shapes are.
`kind:` and `from:` labels are created by `setup`, `area:` on first use because its values are the
marketplace's plugins.

### 12. Priority

The field Priority has P0, P1 and P2 (definitions in the spec), held in `lib/flow.ts` beside Status.
It has no guard: any kind may carry it; `ready` sorts by it and an issue without it sorts last.

### 13. Ghost mode

The binary adds nothing of its own to a body, comment, title or label, apart from the fixed
`deferred` label and comment of `unclaim --until`. `from:main-agent` names an agent on a public
repository by the owner's choice (proposal, decision 2); the binary never adds it unasked.

## Failure behaviour and proof

A repeat of any write verb finds the work done and changes nothing; a `blocked` or `usage` failure
runs no write. Each guard is proved by one `bun test` through `runBin` with a recording fake `gh` on
`PATH`, which a real run cannot show without writing to the public repository; one live loop on
`qsmark-labs/qsm-marketplace` with issues titled `test: ...` closed afterwards proves the Action and
the whole feature flow.

## Risks / Trade-offs

- `gh` flags change (`--blocked-by`, `--parent` are new): a missing flag fails with `gh`'s message,
  loud.
- Several writes are not a transaction; repeatability is the repair.
- Offline, nothing works: one path, no cache, no fallback.
- The owner's approval is not machine-checkable: guards stop a skipped step, the skill and the
  reply carry the yes.

## Open decisions

1. **Should a guard hook refuse raw `gh issue`, `gh project` and `gh api` task calls?** The skill
   forbids them. A hook forces it, as forge-guard does for review threads. Recommended yes, in a
   later change once the verbs have run live: a guard before the verbs are proven blocks the only
   way to file an issue. Not done here.
