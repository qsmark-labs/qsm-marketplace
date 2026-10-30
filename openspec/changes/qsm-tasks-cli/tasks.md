The steps of this one change, in dependency order. Paths are under `plugins/qsm-tasks/` unless they
start with `lib/` of the root or `.github/`. Every group ends with `mise exec -- bun run validate`,
`lint`, `typecheck` and `bun test ./ ./.gates` green and adds nothing beyond the ask. Guards are
proved by `bun test` through `runBin` with a recording fake `gh` on `PATH`; live proof runs on
`qsmark-labs/qsm-marketplace` and org Project #1 through the built binary with `--json`, every issue
titled `test: ...` and closed before the group is ticked.

## 0. Measure what the backend does and bring the board to the flow table

Owns: nothing in the tree; the answers go into design decisions 5, 6 and 10. Blocked by: nothing
(0.4 is the owner's).

- [ ] 0.1 Can GraphQL add and rename a Status option, create the issue type Feedback and the field
      Priority, and read the project's workflows and views? Each answer is `ok` or `manual` for
      `setup` and `doctor`
- [ ] 0.2 Does an Action on `issues: opened` see the parent of an issue made with `add --feature`,
      and does adding or removing a sub-issue on an existing issue trigger anything an Action sees?
- [ ] 0.3 Which view filter separates issues closed as not planned (`reason:"not planned"`)?
- [ ] 0.4 The owner's web-UI steps on the existing board: set issue #3 to the type Feature; rename
      the Status options In Progress to In Dev, In Review to Agent Review and Ready For Human
      Review to Human Review; add Ready For Test, In Test and Blocked (`setup` adds them when 0.1
      allows); switch on the built-in workflow "Pull request linked to issue" with Status Agent
      Review; delete the field Epic stage; rename the view Epics to Features with the filter
      `type:Feature`; set the view Tasks to `-type:Feature -type:Feedback`; later delete the
      organization issue type Epic
- [ ] 0.5 Close every `test:` issue; edit the decisions the answers change

## 1. The binary exists: manifest, flow table, `flow`, install

Owns: `qsm.json` (the twenty verbs with typed args, `--repo`, `--project`), `scripts/cli.ts`,
`lib/flow.ts` and `lib/flow.test.ts` (the table and the derivation function; the test asserts the
rule against the spec's scenarios), `scripts/install.ts` (one `installScript(import.meta)` call;
delete `scripts/install.test.ts`), `types/index.d.ts` and `hooks/noun.generated.ts` (generated with
`bun lib/generate-noun.ts plugins/qsm-tasks`), `.claude-plugin/plugin.json`. Blocked by: 0.

- [ ] 1.1 `qsm.json` declares the twenty verbs; unfinished ones are handlers that exit `failed` with
      reason `not-built` until their group lands, deleted in group 7
- [ ] 1.2 `lib/flow.ts` holds the Status and Priority options, definitions per kind, each guard and
      effect and the derivation rule as one function
- [ ] 1.3 Proof: `qsm-setup install qsm-tasks`, then `qsm-tasks --help` lists twenty verbs and
      `qsm-tasks flow --json` prints the table; a second install changes nothing

## 2. The GitHub module and the reads

Owns: `lib/github/{run,resolve,read}.ts` (one `Run(args, stdin)`, repository and board resolution,
the one query per read), `lib/verbs/read.ts` (`ready`, `list`, `show`), `lib/render.ts` (row and
line text), `scripts/cli.ts`, `lib/verbs/read.test.ts`. Blocked by: 1.

- [ ] 2.1 Resolution: `--repo`, `gh`'s own, linked board, `--project`; `no-repo`, `no-board`,
      `no-gh` are typed errors
- [ ] 2.2 The three reads with their flags (`--feature`, `--qa`, `--spec`, `--search`,
      `--comments`), one query each, no node id in any output
- [ ] 2.3 Proof: through `runBin` with the fake `gh`, a usage error runs no call and `ready` is
      byte-identical twice; live, `list --feature 3`, `show 3 --comments`, `ready` and `ready --qa`
      on this repository print no node id

## 3. Create, edit and note

Owns: `lib/github/write.ts` (create by body on stdin, sub-issue, blocked-by, comment, labels, type),
`lib/github/fields.ts` (set a Status or a Priority, add to the board), `lib/feedback.ts` (the rules
as data), `lib/verbs/write.ts` (`feature`, `add`, `feedback`, `edit`, `note`), `scripts/cli.ts`,
`lib/feedback.test.ts`. Blocked by: 2 and 0.1.

- [ ] 3.1 `feature`, `add` and `edit` with every flag of the spec; the body reaches `gh` on stdin;
      `--spec` writes the label `change:<id>`
- [ ] 3.2 `feedback` validates area, kind, from and sections before any call, refuses private data,
      files into the `QSM_MARKETPLACE` repository and comments on an open same-title issue
- [ ] 3.3 Proof: through the fake `gh`, a `/home/` path exits `blocked` with `private-data`, `##
      Suggested fix` and an unknown area exit `usage`, none posting; live, a `feedback` from another
      directory lands here with its three labels and a repeat comments; `feature` and two `add
      --feature` tasks with `--after` show in `list --feature` in order; `list --spec` of two
      similar ids returns only the exact one, and finds a closed bound task; an over-long id exits
      `usage` and `add --spec` creates a missing label first

## 4. Task flow verbs

Owns: `lib/verbs/task-flow.ts` (`claim`, `unclaim`, `review`, `human`, `close`, `reopen`),
`scripts/cli.ts`, `lib/verbs/task-flow.test.ts` (every guard of the spec's table through the fake
`gh`: a refusal runs no write, a refused second write of `claim` names the first, an item not yet on
the board claims as Todo, `review` on a task already at Agent Review changes nothing). Blocked by:
3.

- [ ] 4.1 The six verbs read their guard and effect from `lib/flow.ts`; `claim` writes the board
      item, Status, assignee, then the feature, each idempotent
- [ ] 4.2 Proof: live on a `test:` task, `claim` twice (the second changes nothing), `review`,
      `human`, `review`, then `unclaim --until` and `unclaim` (`ready` lists it again), `close
      --not-planned --reason`

## 5. The Action and the feature verbs

Owns: `.github/workflows/feature-ready.yml` (new), `lib/verbs/feature-flow.ts` (`plan`, `qa`,
`accept`), `scripts/cli.ts`, the feature cases of `lib/verbs/task-flow.test.ts`. Blocked by: 4, 0.2
and the owner setting the secret `PROJECT_TOKEN`.

- [ ] 5.1 The workflow applies the derivation rule on `issues: opened, closed, reopened`: `gh` only,
      the parent's open sub-issues counted with one listing, concurrency per parent; its copy of the
      rule is proved only by the live loop of 5.3, and `doctor` checks its names
- [ ] 5.2 `plan`, `qa` and `accept` from the flow table; `qa` reads the sub-issues, `accept` writes
      no Status; `lib/flow.test.ts` feeds the spec's derivation cases as a table to the
      `lib/flow.ts` function
- [ ] 5.3 Proof, one live loop on `test: feature`: two tasks, `claim` one (feature In Dev), close
      both (Ready For Test), `qa` (In Test), `add --feature` a fix (Blocked), close it (Ready For
      Test), `qa`, `accept` (closed, `show` prints Done); a feature at Todo whose only task is
      closed without a claim reaches Ready For Test; `qa` straight from In Dev with every task
      closed reaches In Test; an open sub-issue added under a feature at Ready For Test sends it to
      In Dev, `reopen` of a child under a feature In Test makes it Blocked, and `plan` works from In
      Dev, Ready For Test and Blocked; `ready --qa` lists the feature at each waiting point and not
      between; a missing secret fails the run visibly (shown on a fork or named as skipped)

## 6. doctor, setup and the guard against drift

Owns: `lib/github/check.ts`, `lib/github/setup.ts`, `lib/verbs/admin.ts`, `scripts/cli.ts`. Blocked
by: 0.1 and 5.

- [ ] 6.1 `doctor`: each check of the spec with `ok`, `failed` or `manual` and its fix, option names
      only, the Action file's names against the flow table, an extra option or a leftover field as
      `failed` with the web-UI page
- [ ] 6.2 `setup`: fields, missing options with definitions, the issue type Feedback, the labels;
      never the default types; idempotent; prints the manual remainder
- [ ] 6.3 Proof: `doctor` on this repository reads every line; a scratch board from `gh project
      create` takes `setup`, a second `setup` changes nothing, `doctor` lists the views, workflows
      and secret as `manual` for it, and the scratch board is deleted

## 7. Docs, the old stub and the spec

Owns: `README.md` (`## Why it exists` rewritten whole in at most five sentences), `INSTALL.md` and
`USAGE.md` (one row per verb: flags, data, exit codes), the `not-built` stub of 1.1 (deleted),
`openspec/specs/qsm-tasks/spec.md` (the delta merged at archive; its Purpose paragraph by hand).
Blocked by: 5 and 6.

- [ ] 7.1 Docs written, the stub deleted, `bun lib/generate-noun.ts plugins/qsm-tasks` clean, `mise
      exec -- bun run validate`, `lint`, `typecheck`, `bun test ./ ./.gates` and `bun run
      test:hooks` exit 0, and `qsm-tasks` with `gh` absent prints only the `missing` outcome
- [ ] 7.2 Hand the diff to the `qsm-review` strict-reviewer with the add-tool and add-plugin hard
      rules as its checklist; fix every finding that holds
