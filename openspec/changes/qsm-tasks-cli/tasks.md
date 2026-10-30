The steps of this one change, in dependency order. Paths are under `plugins/qsm-tasks/` unless they
start with `lib/` of the root or `.github/`. Every group ends with `mise exec -- bun run validate`,
`lint`, `typecheck` and `bun test ./ ./.gates` green, and adds nothing beyond the ask. Proof runs
on `qsmark-labs/qsm-marketplace` and org Project #1 through the built binary with `--json`; every
issue it creates is titled `test: ...` and is closed (not planned) before the group is ticked, and a
search for open `test:` issues is empty at the end. The owner has made the board, its views and
workflows; nothing here creates them on this repository, and the owner's web-UI steps are named in
group 0.

## 0. Measure what the backend does and bring the board to the flow table

Owns: nothing in the tree; the answers go into design decisions 4, 6, 9, 11 and 17. Blocked by:
nothing (0.6 is the owner's).

- [ ] 0.1 `gh issue create --parent` with a label that does not exist: does it leave an issue
      behind? `gh issue list --search "-is:blocked"` with a closed blocker: does it still block?
- [ ] 0.2 `subIssuesSummary` right after a close: is it current at the moment the `issues: closed`
      event runs? (settles whether the Action needs the search count)
- [ ] 0.3 Is the first-body-line search exact enough: issues bound to `add-x` and `add-x-more`,
      `gh issue list --search '"openspec: add-x" in:body'` then the first-line filter returns only
      the first? If not, decision 6 falls back to the label `change:<id>`
- [ ] 0.4 Does the built-in workflow "Item closed" overwrite a Canceled written just before the
      close? On a `test:` task, set Canceled then close as not planned, and in the reverse order,
      and read the Status after a minute. The answer picks decision 17: `drop` writes Canceled, or
      the Action does
- [ ] 0.5 Can GraphQL read the project's workflows (`workflows { name enabled }`) and views (name),
      and write fields, options with descriptions (add a missing option, rename an existing one)
      and the issue type Feedback? Each answer is `ok` or `manual` for `doctor`/`setup` (design 11)
- [ ] 0.6 The owner's steps on the existing board, in the web UI unless 0.5 shows the API can: set
      issue #3 to the type Feature; rename the Status options In Progress to In Dev, In Review to
      Agent Review and Ready For Human Review to Human Review; add Ready For Test, In Test, Blocked,
      Released and Canceled (`setup` adds them when the API allows); switch on the built-in workflow
      "Pull request linked to issue" with Status Agent Review; delete the field Epic stage; rename
      the view Epics to Features with the filter `type:Feature`; set the view Tasks to
      `-type:Feature -type:Feedback`; later delete the organization issue type Epic. `doctor`
      reports a leftover Epic stage field, or an option the table does not name, as failed with this
      fix
- [ ] 0.7 Close every `test:` issue; edit the decisions the answers change

## 1. The binary exists: manifest, flow table, `flow`, install

Owns: `qsm.json` (every verb of the spec with typed args, `--repo`, `--project`), `scripts/cli.ts`
(`runCli` map: `flow` real, the other verbs absent until their group), `lib/flow.ts` and
`lib/flow.test.ts` (the table as data; the test is the one place a guard is asserted against the
spec's scenarios), `scripts/install.ts` (one `installScript(import.meta)` call, replaces the `br`
probe; delete `scripts/install.test.ts`), `types/index.d.ts` and `hooks/noun.generated.ts`
(generated with `bun lib/generate-noun.ts plugins/qsm-tasks`), `.claude-plugin/plugin.json`
(`types`, description, keywords, no `br`). Blocked by: 0.

- [ ] 1.1 `qsm.json` declares all thirty-three verbs; `checkHandlers` fails for the verbs not yet
      handled, so unfinished verbs are registered as handlers that exit `failed` with reason
      `not-built` until their group lands and this stub is deleted in group 9
- [ ] 1.2 `lib/flow.ts`: the Status options with the definition of each kind and the kind that
      uses each, the Priority options, each verb's guard and effect
- [ ] 1.3 Proof: `qsm-setup install qsm-tasks`, then `qsm-tasks --help` lists the verbs and
      `qsm-tasks flow --json` prints the flow and the two definitions of done; a second install
      changes nothing

## 2. The backend seam and the read verbs

Owns: `lib/backend.ts` (the `Backend` type and the item, kind, field types), `lib/backend-for.ts`,
`lib/github/{run,resolve,read}.ts` (repository and board resolution, `gh` reads),
`lib/verbs/read.ts` (`ready`, `list`, `show`, `tree`, `search`, `notes`, `board`), `lib/render.ts`
(row and line text, one place), `scripts/cli.ts`. Blocked by: 1.

- [ ] 2.1 Resolution: `--repo`, origin, linked board, `--project`; `no-repo`, `no-board`, `no-gh`
      are typed errors
- [ ] 2.2 The seven reads; `ready` is one search plus the Todo filter and the Priority order,
      `ready --qa` is the features at Ready For Test plus those at In Dev with every sub-issue
      closed; text and `data` shape per the spec, no node id anywhere
- [ ] 2.3 One `bun test` through `runBin` with a recording fake `gh`: a usage error runs no call;
      the output of `ready` is byte-identical twice
- [ ] 2.4 Proof: on this repository `qsm-tasks tree 3`, `list --feature 3`, `list --kind feature`,
      `show 4`, `board`, `search "task"`, `notes 3`; `ready` omits the feature; `ready --qa` prints
      `none` or the features waiting; two `test:` tasks with P2 and P0 come out P0 first; each
      `--json` has no node id

## 3. Create and comment verbs

Owns: `lib/github/write.ts` (create issue by body on stdin, sub-issue, blocked-by, comment, labels,
type), `lib/github/fields.ts` (set a Status or a Priority, add to the board), `lib/feedback.ts` (the
feedback rules as data), `lib/verbs/create.ts` (`feature`, `add`, `feedback`, `note`),
`scripts/cli.ts`. Blocked by: 2 and 0.

- [ ] 3.1 `feature` (type Feature, Status Todo), `add` (`--feature`, `--after`, `--spec`,
      `--priority`, `--label`), `note`; the body reaches `gh` on stdin; the sub-issue rule in `add`:
      When `add`, `reopen` or `move` puts an open sub-issue under a feature at Ready For Test or In
      Test, the feature goes to In Dev; under a feature at Done, Released or Canceled it is refused
      with `feature-done`; under a feature at any other Status nothing changes.
- [ ] 3.2 `feedback`: validates area, kind, from and the body sections before any call, refuses
      personal and system data, files an issue of type Feedback with the three labels in the
      `QSM_MARKETPLACE` checkout's repository, and comments on an open same-title issue instead
- [ ] 3.3 Proof: `feature "test: feature" --intent` a file with backticks, two `add --feature`
      tasks with `--after`, `tree` shows order and Status Todo, `note` posts exactly the text;
      `add --feature` on a missing label exits `failed` and `list` shows nothing new
- [ ] 3.4 Proof of feedback, on this repository: a `feedback` from another directory lands in this
      repository with `area:`, `kind:` and `from:` labels and no parent, a repeat comments instead;
      a body with a `/home/` path exits `blocked` with `private-data` and posts nothing; a body with
      `## Suggested fix` exits `usage`; an `--area` that is no plugin exits `usage`

## 4. Edit verbs

Owns: `lib/verbs/edit.ts` (`edit`, `move`, `after`, `unblock`, `assign`, `spec`, `find-spec`),
`lib/github/write.ts`, `scripts/cli.ts`. Blocked by: 3.

- [ ] 4.1 The seven verbs; `edit --body` keeps the binding line; `edit --priority` sets Priority;
      `find-spec` filters to the exact first line
- [ ] 4.2 Proof: `spec` two test tasks `add-x` and `add-x-more`, `find-spec add-x` prints one;
      `after` / `unblock` change what `ready` lists; `after` that would cycle exits `failed`;
      `unblock` of a missing blocker exits `failed` naming both; `move` of a test task from one
      `test:` feature at Todo to another leaves both features at Todo (the rule's other cases are
      proved in 7.2)

## 5. Task flow verbs

Owns: `lib/verbs/task-flow.ts` (`claim`, `unclaim`, `review`, `human`, `reopen`, `close`, `drop`,
`defer`), `scripts/cli.ts` (it uses `lib/github/fields.ts` of group 3),
`lib/verbs/task-flow.test.ts` through `runBin` with a recording fake `gh` (a guard refusal runs no
write; a refused second write of `claim` names the first). Blocked by: 4.

- [ ] 5.1 The eight verbs read their guard and effect from `lib/flow.ts`; `claim` writes the board
      item, Status, assignee, then the feature, each idempotent and treats an item not yet on the
      board as Todo; `close` writes the feature's In Dev before it closes the task; the sub-issue
      rule in `reopen`: When `add`, `reopen` or `move` puts an open sub-issue under a feature at
      Ready For Test or In Test, the feature goes to In Dev; under a feature at Done, Released or
      Canceled it is refused with `feature-done`; under a feature at any other Status nothing
      changes.
- [ ] 5.2 Proof: a `test:` task `claim`ed twice (second changes nothing), its feature In Dev;
      `human` from In Dev is `blocked`; `review`, `human`, `review` again, then `unclaim` from Human
      Review; `defer` from In Dev then `unclaim` (label gone, `ready` lists it), `defer` from Agent
      Review is `blocked`, `unclaim` on a plain Todo task is `blocked`; `close --reason` on a task
      whose feature is at Todo moves the feature to In Dev, and `drop --reason` on a task of another
      Todo feature leaves it at Todo; `reopen`; a Feedback issue takes `close`, `drop` and `reopen`
      (Done, Canceled, Todo) and `claim` on it exits `wrong-kind`; a feature given to `claim` or
      `human` exits `wrong-kind`; another login's task is `held` (a second account, or a recorded
      answer when none exists); Canceled after a minute on a dropped task holds when 0.4 found that
      `drop` writes it, and in the other branch that proof is 6.2
- [ ] 5.3 `claim` run before the auto-add workflow finished (the item is not on the board yet)
      succeeds
- [ ] 5.4 A merged throwaway pull request with `Closes #N` on a `test:` task: `show N` prints Done

## 6. The Action

Owns: `.github/workflows/feature-ready.yml` (new). Blocked by: 1 (it uses the same option names) and
the owner setting the secret `PROJECT_TOKEN`.

- [ ] 6.1 The workflow: `issues: closed`, concurrency per parent, `gh` calls only (parent and type,
      `subIssuesSummary`, the parent's Status, `gh project item-edit`), Ready For Test from In Dev
      or Blocked; if 0.4 shows that Item closed overwrites Canceled, the workflow also sets Canceled
      on an issue closed with `state_reason: not_planned`
- [ ] 6.2 Proof: under `test: feature` at In Dev with two `test:` tasks, close one (Status
      unchanged), close the other (Ready For Test within a minute); read the Actions run; a missing
      secret fails the run visibly (`gh secret remove` then restore is the owner's, so this case is
      shown on a fork or skipped and named); if 0.4 shows that Item closed overwrites Canceled, a
      `test:` task closed as not planned ends Canceled, not Done, after a minute

## 7. Feature flow verbs

Owns: `lib/verbs/feature-flow.ts` (`plan`, `qa`, `finding`, `accept`), `scripts/cli.ts`, the
feature cases of `lib/verbs/task-flow.test.ts`. Blocked by: 5 and 6.

- [ ] 7.1 The four verbs from the flow table; `finding` creates the fix task before the Status
      write; `accept` closes and writes no Status
- [ ] 7.2 Proof, the whole loop on `test: feature`: claim a task (feature In Dev), close both tasks
      (Action: Ready For Test), `qa` (In Test), `finding` (Blocked, a fix task), close the fix task
      (Action: Ready For Test), `qa`, `finding` with an owner's reason (Blocked, a task), close it,
      `qa`, `accept` (closed, `show` prints Done); `accept` from Ready For Test exits `blocked`;
      `plan` on In Dev returns Todo; `drop --reason` on a feature with an open task exits `blocked`
      with `open-children`, on one with none it is Canceled; `qa` straight from In Dev with every
      task closed (the Action route skipped) reaches In Test, and from In Dev with an open task
      exits `open-children`; the sub-issue rule: When `add`, `reopen` or `move` puts an open
      sub-issue under a feature at Ready For Test or In Test, the feature goes to In Dev; under a
      feature at Done, Released or Canceled it is refused with `feature-done`; under a feature at
      any other Status nothing changes. proved with `add` and `move` under a feature at Ready For
      Test (In Dev), `reopen` of a closed task under a feature at In Test (In Dev), and `add`,
      `move` and `reopen` under a feature closed by `accept` (exit `blocked` with `feature-done`); a
      `test:` feature at Todo whose only task is closed by `close` from Todo reaches Ready For Test
      through the Action; `ready --qa` lists the feature at each waiting point and not between

## 8. doctor, setup and the guard against drift

Owns: `lib/github/check.ts`, `lib/github/setup.ts`, `lib/verbs/admin.ts`, `scripts/cli.ts`. Blocked
by: 0.5 and 6.

- [ ] 8.1 `doctor`: each check of the spec with `ok`, `failed` or `manual` and its fix, the built-in
      workflows "Auto-add to project", "Auto-add sub-issues to project", "Item added to project"
      (sets Todo), "Item closed" (sets Done), "Pull request merged" (sets Done) and "Pull request
      linked to issue" (sets Agent Review); reads the Action file's field and option names against
      the flow table; reports a leftover field Epic stage and an extra or wrongly named option as
      failed with the web-UI page, never `qsm-tasks setup`
- [ ] 8.2 `setup`: fields with options and definitions (a missing option is added), the issue type
      Feedback when missing, the label; never touches the default issue types; idempotent; prints
      the manual remainder
- [ ] 8.3 Proof: `doctor` on this repository reads every line and exits as the measurement of 0.5
      allows; a scratch board made with `gh project create` takes `setup` (both fields, all
      options with definitions appear), a second `setup` changes nothing, `doctor` lists the views,
      workflows and secret as `manual` for it, and the scratch board is deleted

## 9. Docs, the old stub and the spec

Owns: `README.md` (`## Why it exists` rewritten whole in at most five sentences: names the binary,
what it refuses to be, when it would have no reason to exist; what you get; install; use; caveats),
`INSTALL.md` and `USAGE.md` (one row per verb: flags, data, exit codes), the `not-built` stub of
1.1 (deleted), `openspec/specs/qsm-tasks/spec.md` (the delta merged at archive; its Purpose
paragraph edited by hand). Blocked by: 7 and 8.

- [ ] 9.1 Docs written, the stub deleted, `bun lib/generate-noun.ts plugins/qsm-tasks` clean
- [ ] 9.2 `mise exec -- bun run validate`, `lint`, `typecheck`, `bun test ./ ./.gates`,
      `bun run test:hooks` exit 0; `qsm-tasks` prints no output on a verb when `gh` is absent except
      the `missing` outcome (`PATH` without `gh`)
- [ ] 9.3 Hand the diff to the `qsm-review` strict-reviewer with the add-tool and add-plugin hard
      rules as its checklist; fix every finding that holds
