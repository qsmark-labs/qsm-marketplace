## Why

Feature #3 moves every task of this project from `.beads/issues.jsonl`, a file each branch carries
its own copy of, to GitHub Issues, so a protected `main` still works. The binary that reads and
writes those issues is the sibling change `qsm-tasks-cli` (the plugin's own `qsm-tasks` binary:
every task operation is one verb, the agent never composes `gh`). This change is the piece after
it: the task tool stops being `br`. The `task-tool` skill holds the model and the flow in terms of
the new verbs, and every file that reads or writes `.beads` or names `br` is changed or deleted,
because "it is not done if any step still needs `br`". It depends on `qsm-tasks-cli`.

## What Changes

- **The `task-tool` skill names GitHub Issues as the main task tool and the `qsm-tasks` verbs for
  every step.** It drops its `br` table and section. The model: a feature is an issue of GitHub's
  default issue type `Feature` holding the intent and the done-when criteria, a task is an issue of
  type `Task` and a sub-issue of it, the change's steps live in `tasks.md`, close rules, deferred
  work, feedback. The `task-writing` skill stays as it is.
- **The skill holds the expected flow, specific to our task tool.** One Status field, each kind
  using its own part of it, both definitions of done, which verb moves each step, and who may move
  what. A task moves Todo, In Dev (`claim`), Agent Review (set when its pull request is linked,
  `review` when that lags or after a finding; CI and the review agents run), Human Review (`human`,
  CI green, every finding fixed), Done (merge with `Closes #N`, no verb); a task never needs QA. A
  feature's Status after planning is derived from its tasks by an Action: In Dev with its first
  claimed or completed task, Ready For Test when every task is closed, Blocked when QA files a fix
  task; `qa` starts the test and `accept` closes it, and a feature never needs review, it has the
  test. Work that will not be done is closed as not planned (`close --not-planned`), with no Status.
  The owner approves pull requests and accepts features, the agent never does either on its own
  word; the QA agent runs In Test. The names and definitions are not copied: the skill says to run
  `qsm-tasks flow`, which prints them from the binary.
- **A QA agent replaces the test-it sub-issue.** A feature has no test-it task anymore. When every
  task is done the feature waits for the QA agent (`qsm-tasks ready --qa` lists it), which tests the
  whole against the business request and the acceptance criteria on the real path, in a Claude Code
  session on the owner's machine for now. A finding, the owner's rejection included, becomes a fix
  task under the feature (`add --feature <n>`) and the Action makes the feature Blocked until it
  closes, then Ready For Test again. The owner accepts the QA result (`accept`) and only then is the
  feature Done and closed. The grilling and plan skills, spec-archive and the cockpit's stage text
  say this instead of test-it, and spec-archive no longer closes a feature.
- **A change is bound to its task by the label `change:<change-id>`**, written by `qsm-tasks add
  --spec` or `edit --spec` and read by `list --spec`, because an issue has no external-reference
  field.
- **A merged pull request with `Closes #N` closes a task.** That is the close for a task; `close` is
  for work that has no pull request, and `close --not-planned` for work that will not be done.
- **The main instruction file names the tools.** In `plugins/qsm-setup/instructions/CLAUDE.md`, the
  "Where things live" table's row "the task tool" names `qsm-tasks` with what tasks mean for us and
  its daily verbs, and the session archive row becomes the memory tool naming `qsm-memory` with what
  memory means for us and its daily verbs (rows in the design, decision 9).
- **qsm-tasks loses `br`.** Its install check and its `br` skill text go; the binary and the install
  are `qsm-tasks-cli`'s. The plugin declares no plug-in dependency.
- **The feedback rule moves.** `plugins/qsm-setup/instructions/CLAUDE.md` and the web-research agent
  name epic `qsm-i1u` in the task tool; they name instead `qsm-tasks feedback --area --kind --from`,
  which files an issue of the type `Feedback` (an issue type of its own, no parent). The rule names
  the labels `area:`, `kind:` and `from:` (who noticed) and the fixed body sections, what happened
  and expected behaviour, with no suggested fix and no personal or system data.
- **The word feature replaces epic in the marketplace prose.** The skills, agents, instruction files
  and READMEs that say "epic" say "feature", one name for one concept (group 11 of `tasks.md` lists
  the files).
- **qsm-worktrunk stops writing `.beads/redirect`.** Issues are on GitHub, so a worktree has nothing
  to point at: `lib/task-store.ts`, the call in the create hook, `StoreIo` in `lib/node-io.ts`, and
  the "shares the task store" requirement go.
- **qsm-memory `orient` drops the in-progress and closed-task lines** (`lib/beads.ts`, the task
  part of `orient.ts`) and its dependency on qsm-tasks. See open question 1.
- **qsm-cockpit drops the Tasks card and the `tasks` verb**, and its dependency on qsm-tasks. See
  open question 2.
- **qsm-builder lens stops reading tasks and saves a pen edit as a loose task** through
  `qsm-tasks add`: `lens tasks`, the task part of `lens brief`, the open-task counts, the `.beads`
  carve-out in `lens/watch.ts` and the "open tasks reach the agent" hook go; `lens/edits.ts` calls
  `qsm-tasks add` without a feature. The dependency on `qsm-tasks` stays, for that one write. See
  open question 3.
- **qsm-toolbox loses its `br` row**, and `knip.jsonc` its `br` binary.
- **qsm-openspec's "no task tool store" stop** becomes "task tool not reachable" (`qsm-tasks doctor`
  does not pass): no GitHub remote, no login or no board stops spec-propose before it writes.
- **Evals that start from `br init`** (qsm-tasks, qsm-openspec, qsm-plan, qsm-review) get a fake
  `qsm-tasks` on PATH that records its arguments; see open question 4.

Not in this change: the `qsm-tasks` binary, its verbs, flow table, doctor, setup and the Action
(`qsm-tasks-cli`, which this change waits on), the release train (its own feature, designed later),
pull requests and review threads (qsm-forge, which this change does not touch), the triage of the 98
open `br` tasks and the untracking of `.beads/` (the migration piece of the feature, which runs
after the readers here are gone), the organization and its board (created by the maintainer),
GitLab, and moving qsm-desktop, qsm-shell and qsm-workbench.

## Capabilities

### New Capabilities

None. Every requirement lands in an existing capability.

### Modified Capabilities

- `qsm-tasks`: GitHub Issues is the main task tool, reached through the plugin's own verbs; the
  model in GitHub terms; the task flow, the feature flow and the QA test in the skill; no test-it
  task.
- `qsm-plan`: the feature's last piece is the QA test, not a test-it task.
- `qsm-worktrunk`: the shared-task-store requirement removed.
- `qsm-memory`: the briefing without task lines; the dependency requirement removed.
- `qsm-cockpit`: the Tasks card and the `tasks` verb removed; the dependency requirement removed.
- `qsm-builder`: the lens without a task reader, an edit saved as a loose task, the dependency kept
  for that write.
- `qsm-toolbox`: the installer sentence no longer names `br`.
- `qsm-openspec`: the stop when no task tool is reachable; archive no longer closes a feature.
- `qsm-setup`: the one place for feedback is the verb `qsm-tasks feedback` and its issue type, and
  the instruction file's table names the task tool and the memory tool.

## Impact

- Plugins: `qsm-tasks`, `qsm-worktrunk`, `qsm-memory`, `qsm-cockpit`, `qsm-builder`, `qsm-toolbox`,
  `qsm-openspec`, `qsm-plan`, `qsm-review`, `qsm-setup`, `qsm-web`, `qsm-essentials`, plus root
  `knip.jsonc`. The full list of files is `tasks.md`.
- `plugin.json` `dependencies`: `qsm-memory` and `qsm-cockpit` lose `qsm-tasks`; `qsm-builder`
  keeps it; `qsm-tasks` has none.
- The person: a session start no longer lists in-progress tasks and the cockpit has no Tasks card;
  the GitHub board is where that is seen.
- Waits on `qsm-tasks-cli`: nothing here can be applied or proved until the binary, its verbs, the
  flow table and the Action `feature-ready.yml` exist.
- The board, its two fields, its views and its built-in workflows are the owner's, set once in the
  web UI and measured; `qsm-tasks setup` and `doctor` own the rest.

## Open questions

1. **Does `orient` read in-progress issues, or drop that part?** Recommendation: drop. Session start
   would then need a network call that fails offline (and loud, by the one-path rule), and the
   briefing is meant to be built with no model call and no wait. The commits of a session's window
   already show what it did; the board shows what is in progress.
2. **Does the cockpit keep a Tasks card?** Recommendation: drop the card and the verb. It polls
   after every task-tool command; a polled network read is slower than the `br` file read it
   replaces, and GitHub's board is the view.
3. **Does the lens keep "a pen edit becomes a task"?** Recommendation: keep the write, through
   `qsm-tasks add` (one call, a loose task with no feature), and drop every read of tasks (open-task
   lists, counts, stale state of an edit). The in-flight `marketplace-lens` change specifies the
   edit-as-task requirement; archive that change first, or this one reconciles it.
4. **How do evals that need a task store run without GitHub?** Recommendation: a fake `qsm-tasks`
   on PATH that appends its arguments to a file the grader reads. Real `test:` issues for every
   eval run would be noise on the public repository, and the real path is proved once, by
   `qsm-tasks-cli` and the feature's QA test.

## Critiques

Devil's advocate:

- A network call replaces a file read in every step of the flow (ready list, lookup, claim, close),
  so a session offline cannot track work. Waived with the reason stated: the feature decides GitHub
  is the main store, and the one-path rule says no fallback; the cost is that tracking stops
  offline, and the change says so in the skill's caveats and in the briefing decision (question 1).
- Binding by a label is looser than `br`'s exact external reference. Fixed: `list --spec` is an
  exact label search and `edit --spec` replaces the label, so a change has one task by construction
  (`qsm-tasks-cli` spec, create and edit verbs).
- The QA agent runs in a session on the owner's machine, so a feature at Ready For Test waits until
  the owner starts it. Waived with the reason: the wait is visible (`qsm-tasks ready --qa` lists it
  and the Features board column Ready For Test shows it) and a dedicated machine is the later
  piece; a timer that starts QA by itself would be an unattended agent nobody approved.
- The skill says the owner accepts features and approves pull requests, but the binary cannot tell
  the owner from the agent (one login). Waived with the reason: the status guards stop a skipped
  step, and the yes is a rule in the skill and a line in the reply; a per-person gate needs the App
  bot's second identity, a later piece.
- Dropping test-it leaves the feature's last proof with one tester. Fixed: the QA agent is a
  separate session that did not build the feature, tests against the business request and the
  criteria on the real path, and the owner still accepts the result before Done.
- qsm-plan and qsm-openspec depend on qsm-tasks, so plan now needs `gh` and a login. Waived: that is
  what "GitHub is the task tool" means; the prerequisite fails `missing` naming `gh`.
- Feedback as an issue of its own type files into a public repository. Fixed in the verb, not
  here: `qsm-tasks-cli` refuses personal and system data and a suggested fix, and the rule in the
  instruction file asks for abstract steps and expected behaviour.

Future archaeologist:

- Why is feedback an issue type with three labels and not a task under a feedback issue? Fixed: the
  design (decision 5) and `qsm-tasks-cli` design decision 11 say an inbox that never ends fits no
  stage of the flow, and the labels are what a reader filters by.
- Why does a spec change get an issue at all when `tasks.md` holds its steps? Fixed: the design
  states it: the issue is what a maintainer and a pull request see; `tasks.md` is the agent's local
  breakdown, never an issue.
- Why is there no test-it task? Fixed: the design says the feature is an issue type and the final
  proof is a test step with its own agent, so a per-feature sub-issue only duplicated what the
  board's Features view shows. Feature #3 holds the owner's decision.
- Why does the skill not list the Status definitions? Fixed: decision 1 says `qsm-tasks flow` owns
  names, definitions and guards, and the skill owns who acts and when, so a rename edits one file.
- Why does the CLAUDE.md table name `qsm-tasks` and `qsm-memory` when skills say "the task tool"?
  Fixed: decision 9 says the instruction file is the one place an agent learns, on every task, which
  binary serves a role; skills and agents keep the role name.
- Why was `br` removed rather than kept for local tasks? Not restated here: feature #3 holds the
  decision and its rejected options, and this change cites it instead of copying it.

Scope sniper:

- The lens, the cockpit and `orient` readers could be a second change. Waived with the reason: they
  call `br`, so removing `br` from qsm-tasks without them leaves a broken `orient`; tasks.md orders
  them before the qsm-tasks lines and each is a one-file removal, not a redesign.
- The eval shim could be skipped by deleting the evals. Waived: the evals are how the skills are
  proved (`bun run eval`), and the shim is one script.
- The plan, grilling and spec-archive skills, their specs and the cockpit's stage text could be
  left saying test-it. Waived: they would tell the agent to create a task the flow no longer has;
  tasks.md group 9 edits them and each is a sentence.
- The prose rename of epic to feature across the marketplace could wait. Waived: two names for one
  concept is the first thing a new reader trips on, and the rename is a list of files, group 11,
  with a grep that proves it.
- The memory row in CLAUDE.md is not about tasks. Waived: it is the same table row edit, and
  naming one tool by binary and not the other would leave the table inconsistent.
- Question 3's "keep the pen-edit write" is the biggest piece of new behaviour here. Recorded as
  open question 3 with a drop-it fallback that removes the whole lens write path in one task.
