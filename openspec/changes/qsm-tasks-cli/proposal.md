## Why

Feature #3 moves the project's tasks from a file in git to GitHub issues and a board. An agent that
works on that board with raw `gh`, `jq` and GraphQL composes several calls per step (a sub-issue
needs a node id fetched first, a field write needs a project id, a field id and an option id), gets
the flow wrong in a different way each session, and posts whatever it improvised. This change makes
the task tool a plugin with its own binary, `qsm-tasks`, whose twenty verbs cover the flow from a
business request to an accepted feature, so the agent never composes a backend call and a gap is
fixed by extending the binary, never by a skill telling the agent to call a raw API. It replaces the
two qsm-forge changes that tried to do part of it (`forge-issue-verbs`, `forge-board-verbs`): the
task tool serves the marketplace's "task" port, qsm-forge stays pull requests and review threads,
and neither knows the other.

## What Changes

- **A binary `qsm-tasks`** in `plugins/qsm-tasks/`, noun `$.tasks`, verbs described in `qsm.json`,
  text output for the agent and the `--json` envelope for hooks. A flag, not a verb, wherever
  GitHub already models the thing.
- **The parent of tasks is GitHub's default issue type Feature, with one Status field.** A task, a
  feature and a Feedback issue each use their own part of its eight options.
- **The flow is code.** One table in `lib/flow.ts` holds the options, their definitions per kind,
  every guard and the rule that derives a feature's Status; a verb that would break the flow fails
  `blocked` naming the rule.
- **A feature's Status is derived.** An Action, `.github/workflows/feature-ready.yml`, is its only
  writer after planning; `qa` reads the sub-issues, so QA never waits for it.
- **Cancel, binding and Done are GitHub's own.** A close as not planned, the label `change:<id>`
  and "Item closed" replace a Status, a body convention and a verb.
- **`doctor` and `setup`** check and create what the API allows and name the rest, with the one
  place to set each. **Feedback** is its own issue type with `area:`, `kind:` and `from:` labels,
  fixed body sections, no suggested fix and no private data. **Priority** is a field, P0 to P2.
- **Ghost mode.** The binary adds no footer, marker or trailer of its own.

Replaces `forge-issue-verbs` and `forge-board-verbs`, both deleted. Moved from them: the Action and
its token, "Done is GitHub's", the board's option names and definitions (now `lib/flow.ts`), `ready`
as one read, the "refused call fails loud, does nothing else" rule and body text on stdin. Left
behind: the `gh` and `gl` sub-command shape, `--owner --project` on every call, a guard hook that
refuses raw `gh issue` calls, a second field for the parent.

Not in this change: pull requests, review threads and git (qsm-forge), GitLab, a second backend, the
QA agent, the GitHub App bot that opens pull requests, the skills that call the verbs and the
migration of `br` tasks (`tasks-on-github-issues`, which depends on this change), views and built-in
workflows (the API cannot create them), and the release train.

The release train is its own feature, designed later with its own grilling: versions, a two-week
release that Done items are picked into, a Status Released set then, the items archived two weeks
later (GitHub's Iteration field, GitHub Releases and the built-in auto-archive are its candidate
tools), and release notes built from the items in Released. The owner: "i want to a add full release
versions, so released is what we pick into the 2weeks release, and from there after 2weeks it gets
archived." About the Iron Law of AGENTS.md that forbids versioning in the tree: "that rule is
relevant for local not releasing projects ... normal versioning and releasing for a proper project
is okay, and wanned." The release feature reconciles that law; this change edits no AGENTS.md.

## Capabilities

### New Capabilities

None. Every requirement lands in the existing `qsm-tasks` capability.

### Modified Capabilities

- `qsm-tasks`: a binary with the verbs of the whole task flow, the flow table, the derived feature
  Status and its Action, `doctor` and `setup`, and the install that compiles the binary; the `br`
  install and the no-binary requirements are removed.

## Impact

- `plugins/qsm-tasks/`: `qsm.json`, `scripts/{cli,install}.ts`, `lib/` (flow, github, verbs),
  `types/index.d.ts` and `hooks/noun.generated.ts` (generated), `INSTALL.md`, `USAGE.md`,
  `README.md`, `.claude-plugin/plugin.json`.
- `.github/workflows/feature-ready.yml` and the repository secret `PROJECT_TOKEN` (the owner sets
  it, with the `project` scope; `doctor` says so).
- The existing board is changed by hand, once, by the owner (tasks.md group 0): issue #3 gets the
  type Feature, the Status options are renamed and added, the field "Epic stage" is deleted and the
  views are changed. `doctor` reports a leftover as failed with its fix.
- Consumers: `qsm-builder`, `qsm-openspec`, `qsm-plan` and the skills reach the verbs through the
  skill `task-tool` and `$.tasks`; their edits are `tasks-on-github-issues`.

## Decisions of the owner

1. **`close` stays** (2026-10-29): `close <id> --reason "<what was done>"` finishes a task that no
   merge closes, such as a decision or a spec-only task.
2. **Feedback is an issue type with labels, not a feature's child** (2026-10-30). A feedback feature
   is an inbox that never ends. The owner: "i want area, kind, from/who noticed, some basic log of
   things that lead to that, WITHOUT ANY PERSONAL OR SYSTEM INFO, just abstract stuff, and than the
   rest. Ideally no suggested fix, but how i want it to behave." The `from:` label names an agent on
   a public repository: "its an AI marketplace, im okay with keeping this there."
3. **Priority is a board field, P0 to P2** (2026-10-30), because `br` tasks carry a priority today.
4. **The migration starts with a triage** (2026-10-30): feature by feature, keep, close or merge,
   and only live work moves to GitHub. That is the migration piece of feature #3, not this change.
5. **GitHub's defaults: the parent is a Feature, and there is one Status** (2026-10-30). The owner:
   "and what if we used the github defaults for us? Cannot we use features instead of epics, than
   stack tasks under them, and than qa test the feature instead of the epic? So we dont overengineer
   and destroy the github ecosystem?" So no custom Epic type and no second field "Epic stage".
6. **Each kind uses its own part of the one Status** (2026-10-30). The owner: "tasku staci review,
   nepotrebuje qa, a feature zase nepotrebuje review, ma test." A task uses Todo, In Dev, Agent
   Review, Human Review and Done; a feature Todo, In Dev, Ready For Test, In Test, Blocked and Done;
   a Status of the other kind is refused. The Action stays, on the one field.
7. **Duplicate nothing GitHub does, but keep one door** (2026-10-30). After a review the owner:
   "i dont want to duplicate anything that github already has a way to do normally" and "i like the
   findings overall, but i still want my one tasks tool". So: a feature's Status is derived (the
   Action is its writer), a cancellation is a close as not planned (no Status Canceled), a change is
   bound by a label, `reject` and `finding` are `add --feature`, reads are flags, and agents still
   never call raw `gh`. Released is not added now; it returns with the release train.

## Critiques

Devil's advocate:

- Twenty verbs is a CLI nobody remembers, and each is a contract forever. Waived: the agent reads
  `qsm-tasks --help` and the skill's flow table, and each verb is a flow step with its own guard;
  everything else is a flag, and a verb that duplicated `show`, `list` or `add` was cut.
- The guard "who may move what" cannot be enforced: the owner and the agent share one `gh` login.
  Fixed in part: the verbs enforce state, so an agent cannot skip a step; the owner's yes is a rule
  in the skill and the reply. Waived for the person: a per-person gate needs the App bot's second
  identity, and a card dragged by hand on the board bypasses every guard, which is the owner's move.
- The Action is the only writer of a feature's Status, so a failed run leaves it wrong. Fixed in
  part: it fails visibly in the Actions tab, `qa` and `accept` read the sub-issues and never trust
  the Status alone, and `ready --qa` lists by the same predicate. Whether an Action sees a sub-issue
  added to an existing issue is unmeasured (task 0.2); if not, the Status lags until the next event
  on a child, and the guards still hold.
- One Status for three kinds mixes their words. Waived: each option names its meaning per kind in
  one table row, a Status of the other kind is refused and the views filter by kind.
- `doctor` wants the board's built-in workflows and views; the GraphQL schema may not expose them.
  Unmeasured (task 0.1); if unreadable they are `manual` with the web-UI place and `doctor` exits
  `partial`, never green on a guess.
- One token for the owner and for the Action; a leaked `PROJECT_TOKEN` writes the org board. Waived
  until the App bot piece; stored as a repository secret, never printed.
- The personal-data check is a pattern list: it misses a leak it has no pattern for and refuses a
  harmless match. Waived: the refusal names the kind, so the caller rewrites it abstractly, and a
  miss is a pattern added in one place, `lib/feedback.ts`.
- A closed-not-planned issue ends Done on the board, like a completed one. Waived: GitHub keeps the
  close reason, the views separate them by it (task 0.3), and a Status would be a second copy.

Future archaeologist:

- Why is there a flow table in code and also a skill? The table owns names, definitions and guards,
  the skill owns who acts and when; the skill says to run `qsm-tasks flow` instead of copying.
- Why can a feature's Status disagree with its tasks? Design decision 5: the Action writes it, the
  guards read the children.
- Why is the Action in this repository's `.github/` and not in the plugin? GitHub runs only that
  directory, and the trigger is a close in the browser where no verb runs; `doctor` checks its
  names.
- Why is there no `finding`, `reject`, `drop` or `defer`? Design decisions 1, 5 and 6: each was an
  `add`, a `close` or an `unclaim` under another name.

Scope sniper:

- `setup` for a new repository is speculative with one repository. Waived: it is the only way the
  options and definitions are not typed by hand twice, and `doctor` needs the same table.
- No unit tests beyond the flow table and the fake-`gh` guard test: proof is one live loop on this
  repository plus a `bun test` through `runBin` for what a real run cannot show without writing to
  the public repository.
