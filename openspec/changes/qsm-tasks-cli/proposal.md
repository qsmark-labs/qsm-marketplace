## Why

Feature #3 moves the project's tasks from a file in git to GitHub issues and a board. An agent that
works on that board with raw `gh`, `jq` and GraphQL composes several calls per step (a sub-issue
needs a node id fetched first, a field write needs a project id, a field id and an option id), gets
the flow wrong in a different way each session, and posts whatever it improvised. This change makes
the task tool a plugin with its own binary, `qsm-tasks`, whose verbs cover the whole flow from a
business request to an accepted feature, so the agent never composes a backend call and a gap is
fixed by extending the binary, never by a skill telling the agent to call a raw API. It replaces the
two qsm-forge changes that tried to do part of it (`forge-issue-verbs`, `forge-board-verbs`): the
task tool serves the marketplace's "task" port, qsm-forge stays pull requests and review threads,
and neither knows the other.

## What Changes

- **A binary `qsm-tasks`** in `plugins/qsm-tasks/` (one plugin, one binary named after it), noun
  `$.tasks`, verbs described in `qsm.json`, text output for the agent and the `--json` envelope of
  `lib/cli-base.ts` for hooks and scripts. Thirty-three verbs in six groups:
  - read: `ready`, `list`, `show`, `tree`, `search`, `notes`, `board`;
  - create: `feature`, `add`, `feedback`, `finding`;
  - edit: `edit`, `move`, `after`, `unblock`, `assign`, `spec`, `find-spec`, `note`;
  - task flow: `claim`, `unclaim`, `review`, `human`, `reopen`, `close`, `drop`, `defer`;
  - feature flow: `plan`, `qa`, `accept` (and `finding`, listed under create);
  - admin: `doctor`, `setup`, `flow`.
- **The parent of tasks is GitHub's default issue type Feature, and one Status field serves both
  kinds.** A task uses Todo, In Dev, Agent Review, Human Review, Done, Released and Canceled; a
  feature uses Todo, In Dev, Ready For Test, In Test, Blocked, Done, Released and Canceled. Each
  option has one definition
  per kind, "not used" where a kind never takes it, and a Status of the other kind is refused. No
  second field, no custom issue type for the parent.
- **The flow is code, not prose.** The flow (one Status field, a part of it for each kind), the two
  definitions of done and the guard of every move are one table in `lib/flow.ts`; the verbs, `flow`,
  `doctor` and `setup` read it. A verb that would break the flow fails `blocked` naming the rule.
- **The backend is GitHub and stays behind one interface.** `lib/backend.ts` is the port, backend
  neutral (items, kinds, Status, Priority); `lib/github/` is the only code that knows `gh`, issue
  types, sub-issues, `blockedBy` and the project fields. No verb output carries a node id, a field
  id or a GraphQL shape.
- **A GitHub Action carried over** from `forge-board-verbs`, on the one Status field:
  `.github/workflows/feature-ready.yml` moves a feature to Ready For Test when its last open
  sub-issue closes, from In Dev or Blocked. `gh` only, the secret `PROJECT_TOKEN`, nothing posted.
- **Done is GitHub's**: a task is closed by a merge with `Closes #N` and a feature by `accept`, and
  the board's "Item closed" workflow sets Done for both. `drop` closes a task or a feature as not
  planned and sets Canceled. No verb writes Done, and nothing sets Released in this change.
- **The QA step replaces the test-it task.** `qa`, `finding` and `accept` are its verbs, and
  `ready --qa` is its list. A rejection by the owner is a `finding`.
- **`doctor` and `setup`** check and create everything the API allows (the Status and Priority
  fields with their options and definitions, the issue type Feedback, the label `deferred`) and name
  the rest (views, built-in workflows, the secret) with the one place to set each. `setup` never
  touches GitHub's default issue types.
- **Feedback is its own issue type**, `Feedback`, with no parent: `feedback` files it in the
  marketplace repository with the labels `area:<plugin or marketplace>`, `kind:<kind>` and
  `from:<who noticed>`, a body of fixed sections (what happened, expected behaviour, context) and
  no suggested fix, and refuses a title or body that holds personal or system data.
- **A Priority field**, P0, P1 and P2, on the board: `add`, `edit` and `feedback` set it, `list`
  filters by it, and `ready` lists P0 first.
- **Ghost mode.** The binary adds no footer, marker, label or trailer of its own to anything it
  posts; the text and the labels are what the caller passed.

Replaces `forge-issue-verbs` and `forge-board-verbs`, both deleted. Moved from them: the Action and
its token (decision 9), "Done is GitHub's" (decision 8), the board's field option names and
definitions (now `lib/flow.ts`), `ready` as one search (decision 4), the "refused call fails loud,
does nothing else" rule, and body text on stdin. Left behind and not carried: the `gh` and `gl`
sub-command shape, `--owner --project` on every call (the board is resolved from the repository,
decision 3), a guard hook that refuses raw `gh issue` calls, a second field for the parent.

Not in this change: the release train (below), pull requests, review threads, git (qsm-forge),
GitLab, a second backend, the QA agent itself, the GitHub App bot that opens pull requests, the
skills that call the verbs and the migration of `br` tasks (`tasks-on-github-issues`, which depends
on this change), and views and built-in workflows, which the API cannot create.

The release train is its own feature, designed later with its own grilling: versions, a two-week
release that Done items are picked into, Released set then, the items archived two weeks later
(GitHub's Iteration field, GitHub Releases and the built-in auto-archive are its candidate tools),
and release notes built from the items in Released. Canceled items are not archived automatically.
This change only adds the Status option Released: `setup` creates it, `doctor` checks it and `flow`
prints it. The owner: "i want to a add full release versions, so released is what we pick into the
2weeks release, and from there after 2weeks it gets archived." On Canceled: "jeste bych pridal
canceled. Kde neni archivace ideally - jakoze automaticka. A z tech released se potom sestavi
release notes." About the Iron Law of AGENTS.md that
forbids versioning in the tree: "that rule is relevant for local not releasing projects ... normal
versioning and releasing for a proper project is okay, and wanned." The release feature reconciles
that law; this change edits no AGENTS.md.

## Capabilities

### New Capabilities

None. Every requirement lands in the existing `qsm-tasks` capability.

### Modified Capabilities

- `qsm-tasks`: a binary with the verbs of the whole task flow, the flow table, the backend boundary,
  `doctor` and `setup`, the Action, and the install that compiles the binary; the `br` install and
  the no-binary requirements are removed.

## Impact

- `plugins/qsm-tasks/`: `qsm.json`, `scripts/{cli,install}.ts`, `lib/` (flow, backend, github,
  verbs), `types/index.d.ts` and `hooks/noun.generated.ts` (generated), `INSTALL.md`, `USAGE.md`,
  `README.md`, `.claude-plugin/plugin.json`.
- `.github/workflows/feature-ready.yml` in this repository and the repository secret
  `PROJECT_TOKEN` (the owner sets it).
- The token needs the `project` scope; `doctor` says so.
- The existing board is changed by hand, once, by the owner: issue #3 gets the type Feature, the
  Status options are renamed and added, the field "Epic stage" is deleted and the views are changed.
  `tasks.md` group 0 names each step, and `doctor` reports a leftover field as failed with its fix.
- Consumers: `qsm-builder`, `qsm-openspec`, `qsm-plan` and the skills reach the verbs through the
  skill `task-tool` and `$.tasks`; their edits are `tasks-on-github-issues`.
- Proof runs on `qsmark-labs/qsm-marketplace` and org Project #1 with issues titled `test: ...`,
  all closed afterwards.

## Decisions of the owner

1. **`close` stays** (2026-10-29). `close <id> --reason "<what was done>"` finishes a task that no
   merge closes, such as a decision or a spec-only task: task only, state completed.
2. **Feedback is an issue type with labels, not a feature's child** (2026-10-30). A feedback feature
   is an inbox that never ends, so it sits in the Features view with no Status that means anything.
   The owner: "i want area, kind, from/who noticed, some basic log of things that lead to that,
   WITHOUT ANY PERSONAL OR SYSTEM INFO, just abstract stuff, and than the rest. Ideally no suggested
   fix, but how i want it to behave." The `from:` label names an agent on a public repository, and
   the owner accepts it: "its an AI marketplace, im okay with keeping this there."
3. **Priority is a board field, P0 to P2** (2026-10-30), because `br` tasks carry a priority today
   and the triage keeps it.
4. **The migration starts with a triage** (2026-10-30): feature by feature, keep, close or merge,
   and only live work moves to GitHub. That is the migration piece of feature #3, not this change.
5. **GitHub's defaults: the parent is a Feature, and there is one Status** (2026-10-30). The owner:
   "and what if we used the github defaults for us? Cannot we use features instead of epics, than
   stack tasks under them, and than qa test the feature instead of the epic? So we dont overengineer
   and destroy the github ecosystem?" He chose the default issue type Feature as the parent of
   tasks, one Status field for features and tasks, and the word "feature" everywhere. So no custom
   Epic type and no second field "Epic stage" are built. Reason: a second field is a second source
   of truth (GitHub's best practices for projects keep one).
6. **Each kind uses its own part of the one Status** (2026-10-30). The owner: "tasku staci review,
   nepotrebuje qa, a feature zase nepotrebuje review, ma test." So the options are Todo, In Dev,
   Agent Review, Human Review, Ready For Test, In Test, Blocked, Done and Released (Canceled follows
   in decision 7); a task never takes Ready For Test, In Test or Blocked, a feature never takes
   Agent Review or Human Review, and a Status of the other kind is refused (`wrong-kind`), because
   the views filter by kind and Status. Consequences he chose in the same decision: the Action
   stays, on the one field, as `feature-ready.yml` with its repository secret (Impact); `unclaim` is
   the verb that puts a claimed task back to Todo; `reject` is deleted because the owner's rejection
   is a `finding` (In Test to Blocked with a fix task); `qa` has two routes, the Action's Ready For
   Test and the verb from In Dev when every sub-issue is closed: "Both should be possible, pref the
   action", the owner's explicit exception to the one-path rule (design decision 16); and Released
   is an option only, set by nothing in this change.
7. **Canceled is a Status for both kinds** (2026-10-30), the tenth option after Released: "Closed
   without being done: dropped, duplicate or superseded; the reason is the last comment". `drop`
   closes as not planned and sets it, and takes a feature too when it has no open sub-issue. Whether
   "Item closed", which sets Done on every close, overwrites the Canceled that `drop` writes is
   measured in task 0.4, and then one of two: `drop` writes the Status itself, or the Action, which
   already runs on `issues: closed`, sets Canceled when the close reason is not planned and `drop`
   writes nothing to Status (design decision 17).

## Critiques

Devil's advocate:

- Thirty-three verbs is a CLI nobody remembers, and each is a contract forever. Waived with the
  reason: the agent does not remember them, it reads `qsm-tasks --help` and the skill's flow table,
  and a verb is a flow step. Every verb earns its place by a step of the feature's flow that
  otherwise becomes a raw call; the spec's scenarios name that step, and a verb with none was cut (a
  `status` verb duplicates `show`, `reject` duplicates `finding`, the QA agent's list is a flag of
  `ready`, a feature is never reopened: new work is a new feature).
- The guard "who may move what" cannot be enforced: the owner and the agent share one `gh` login.
  Fixed in part: the verbs enforce state (`accept` only from In Test with no open sub-issue, `qa`
  only from Ready For Test or from In Dev with every sub-issue closed, `human` only from Agent
  Review), so an agent cannot skip a step; the owner's yes is a rule in the skill and the reply, not
  in the binary. Waived for the person: no per-person gate exists without a second identity, which
  is the App bot's piece, and a card dragged by hand on the board bypasses every guard, which is the
  owner's own move.
- `finding` sends a feature to Blocked, but the Action fires only on a close, so a feature at
  Blocked with every task closed would wait forever. Fixed: `finding` creates the fix task that
  carries the reason before the Status write, and the Action moves the feature when that task
  closes.
- "Item closed" may overwrite the Canceled that `drop` writes, since both fire on the same close.
  Unmeasured; task 0.4 measures it and design decision 17 holds the two outcomes: `drop` writes
  Canceled, or the Action does on a close that is not planned. Neither leaves Done on a dropped
  item.
- `qa` has two routes, the Action's and the verb's, which is a second path. Waived: it is the
  owner's explicit exception ("Both should be possible, pref the action"), design decision 16 says
  why (an Action that failed or lags must not stop QA) and bounds it: both routes end in the same
  guard, and the verb takes only a feature whose sub-issues are all closed.
- One Status for two kinds: the options mix both kinds' words. Waived with the reason: each option
  names both meanings in the same table row, a Status of the other kind is refused, and the views
  filter by kind, so no field is added to tell them apart.
- `doctor` wants to read the board's built-in workflows and views; the GraphQL schema may not expose
  them. Unmeasured; task 0 measures it. If unreadable, `doctor` reports those checks as `manual`
  with the web-UI place and exits `partial`, never green on a guess.
- A second backend behind `lib/backend.ts` is speculation: one implementation makes an interface
  decoration. Waived with the reason: the interface is how the verbs are tested without `gh` (a
  recording backend in the flow tests) and it is where "extended in one place" is true; no
  registry, no config switch, no second implementation is built.
- `ready` lists Todo only, so a new session cannot see the task it already claimed. Fixed: the
  skill starts a session with `ready` and `list --mine`; the two together are the old ready list.
- One token for the owner and for the Action; a leaked `PROJECT_TOKEN` writes the org board.
  Waived until the App bot piece; stored as a repository secret, never printed.
- The personal-data check is a pattern list: it misses a leak it has no pattern for (a colleague's
  name, a client's domain) and refuses a harmless match (an example email). Waived with the
  reason: the refusal names the kind of match, so the caller rewrites it abstractly, and a miss is
  a pattern added in one place, `lib/feedback.ts`; the agent still writes abstractly by the skill.
- Free `area:` values grow labels nobody cleans. Fixed: `--area` is `marketplace` or a plugin
  named in the marketplace's `.claude-plugin/marketplace.json`, anything else is `usage`.
- A body section cannot stop a suggested fix written inside "What happened". Waived: the binary
  refuses a heading outside the three, the skill asks for behaviour, the owner reads the rest.

Future archaeologist:

- Why is there a flow table in code and also a skill? Fixed: the design says the table owns names,
  definitions and guards, and the skill owns who acts and when; the skill says to run
  `qsm-tasks flow` instead of copying definitions.
- Why does `finding` create a task? Fixed: decision 7 names the Action-fires-on-close gap in one
  paragraph.
- Why does one Status field serve a feature and a task, with options a kind never takes? Fixed:
  owner decisions 5 and 6 and design decision 5, which gives each option one definition per kind.
- Why no `--owner --project` flags, when the old change had them? Fixed: decision 3 says the board
  moved once and a repository has one linked board; `--project owner/number` overrides for the case
  of two.
- Why does `find-spec` search bodies at all? Fixed: decision 6, an issue has no external reference,
  so the first body line is the binding and the verb is its only reader and writer.
- Why is the Action in this repository's `.github/` and not in the plugin? Fixed: GitHub runs only
  that directory, the trigger is a close in the browser where no verb runs, and the field names in
  it are checked against `lib/flow.ts` by `doctor`.
- Why is there a Status option Released that nothing sets? Fixed: the release train is its own
  feature; this change only gives the option a name and a definition so the board and the table
  agree from the start.

Scope sniper:

- `setup` for a new repository is speculative with one repository. Waived: the person asked for it
  so a second project is one command, it is the only way the field options and their definitions
  are not typed by hand twice, and `doctor` already needs the same table.
- `tree`, `board`, `notes`, `search` are reads `gh` can do. Fixed the other way: the agent never
  composes a backend call, so a read it needs is a verb; each is one call and one table of output.
- `plan`, `unclaim` and `unblock` could be flags. Waived: each is one flow step with a guard, a
  flag would hide the step from `--help` and from the noun.
- `reject` was cut: the owner's rejection is a `finding` (In Test to Blocked with a fix task titled
  by the reason), so a second verb did the same write under another name.
- `ready --qa` could be a verb of its own. Waived the other way: it is the ready list of the other
  kind, one search, and a verb would be the thirty-fourth for one filter.
- Priority is a fourth thing to keep right on every task. Waived: the owner chose it, and it is one
  field in the same table, one flag on three verbs and one sort key in `ready`.
- No unit tests beyond the flow table: proof is a real run per group on this repository, plus one
  `bun test` through `runBin` with a recording fake `gh` for what a real run cannot show (a usage
  error or a refusal runs nothing further, a guard refusal runs no write).
