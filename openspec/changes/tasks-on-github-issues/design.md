## Context

Today `qsm-tasks` serves the task port with `br`: one skill, an install probe, and
`.beads/issues.jsonl` in git. worktrunk writes `.beads/redirect`, memory's `orient` runs `br show`
and `br list`, cockpit runs `br list`, the lens runs `br list` and `br create`, toolbox lists `br`.
The skills of plan, openspec, essentials and review already say "the task tool", which keeps them
small here.

## Decisions

### 1. The skill holds who acts and when; the binary holds the names

`qsm-tasks flow` prints options, definitions and guards from the binary's table, so the skill
copies none of them and a rename edits one file. The skill holds this table:

| Step | Verb | Who and when |
| --- | --- | --- |
| session start | `ready`, `list --mine` | the agent, first thing |
| feature | `feature "<goal>" --intent <file> --spec <change-id>` | the planning session, after the owner's yes to the plan |
| split | `add "<task>" --feature <n>`, `edit <task> --after <blocker>` | the owner and the agent together, after the plan |
| claim | `claim <task>` | the session that builds the task |
| give back, defer | `unclaim <task>`, `unclaim <task> --until <date>` | the session that cannot continue; the main agent |
| pull request open | nothing: the built-in workflow sets Agent Review; `review <task>` when it lags or after a finding | GitHub; the builder |
| CI green, every finding fixed | `human <task>` | the builder, only then |
| task merged into `feature/<n>` | nothing: the Action closes it, the board sets Done | the owner merges |
| decision or spec-only task | `close <task> --reason` | the main agent, on the owner's word |
| not doing it | `close <n> --not-planned --reason` | the main agent, on the owner's word |
| feature waits for QA | nothing: the Action sets Ready For Test; `ready --qa` lists it | GitHub; the QA agent |
| QA takes it, finds something | `qa <feature>`, `add --feature <feature> "<finding>"` | the QA agent only |
| owner rejects | `add --feature <feature> "<reason>"` | on the owner's word only |
| owner accepts | nothing: the owner merges the feature pull request into main | the owner |
| progress | `note <id> "<text>"` | anyone, in the owner's name |
| feedback | `feedback "<title>" --area <a> --kind <k> --from <f>` | any agent; a subagent's one permitted create |
| feedback handled | a task whose body starts `From #<feedback>`, then `close <n> --reason "filed as #<task>"` | the main agent, on the owner's word |

### 2. A change is bound to its feature

The feature carries `change:<change-id>`; spec-propose looks it up with `list --spec` before it
writes and binds with `feature --spec` or `edit <feature> --spec`. Tasks carry no label: they are
sub-issues of the bound feature, created at the split. Reason: the spec describes the feature's
behaviour, and a task is a pull request's worth of it.

### 3. QA instead of test-it, the merge instead of `accept`

A task needs no QA: review agents, CI and the owner's merge. A feature needs no review: it has
the QA agent, which did not build it and tests every path of its models. The owner's merge of the
feature pull request into main is the accept, so the agent never closes a feature and no verb
exists for it.

### 4. Deferred work is a label and a comment

`deferred` and a comment with the date; the ready list leaves it out. Never a silent close.

### 5. Feedback is filed by a verb into its own issue type

The instruction file and the web-research agent name `qsm-tasks feedback`, never an issue number,
because a number in an instruction file goes stale. The verb's checks are `qsm-tasks-cli`'s.

### 6. The readers go, apart from one write

| Reader | Decision | Files |
| --- | --- | --- |
| worktrunk redirect | removed | `lib/task-store.ts` and its test, the `StoreIo` half of `lib/node-io.ts`, the call in `hooks/worktree-create.ts`, the redirect test in `scripts/hooks.test.ts`, README |
| memory `orient` task lines | removed: session start must not need the network | `lib/beads.ts`, the tracker part of `lib/orient.ts` and its tests, `qsm.json` description of `orient`, README, `plugin.json` dependency |
| cockpit Tasks card | removed: a polled network read; the board is the view | `lib/tasks.ts`, the Tasks state and the CLOSE stage text of `lib/cockpit.ts`, the card in `hooks/register.tsx`, `plugin.json` dependency |
| lens task reads | removed | `lib/lens/tasks.ts`, `brief.ts`, the task fields of `model.ts`, `page.ts`, `view.ts`, `serve.ts`, the `.beads` carve-out of `watch.ts` |
| lens pen edit | kept, through `qsm-tasks add` with no feature | `lib/lens/edits.ts`, `pull.ts` |
| toolbox and knip `br` | removed | `lib/catalog.ts` row, `skills/toolbox/SKILL.md`, README, root `knip.jsonc` |

The word epic is replaced in every file `grep -rniw 'epics\?' plugins/*/skills plugins/*/agents
plugins/qsm-setup/instructions AGENTS.md README.md` finds.

### 7. Order: readers first, qsm-tasks last

`br` stays usable until nothing calls it, so every intermediate state builds and passes; a test of
a removed behaviour goes with it, never kept green by a fake `br`.

### 8. Evals use a fake `qsm-tasks`

One recording stub in root `lib/fixtures/` for the evals of qsm-tasks, qsm-openspec, qsm-plan and
qsm-review; real `test:` issues per eval run would be noise on the public repository.

### 9. The instruction file names the tools

Two rows of "Where things live" change, three columns kept:

```text
| the task tool, `qsm-tasks` | what is unfinished, in what order, and who has it, never a TODO in prose; a feature holds the intent, the models and the spec of a piece of work, and a task is one pull request under it; daily verbs `qsm-tasks ready`, `list --mine`, `show <id>`, `claim <id>`, `note <id> "<text>"`, and `--help` for the rest | daily |
| the memory tool, `qsm-memory` | what a person and the model said in every earlier main session on this machine, saved by a hook and searched by full text, never acceptance criteria; plus one short-term note for the next session, which expires; daily verbs `qsm-memory search "<words>"`, `show <id>`, `note "<text>"` | never by hand, except the note |
```

## Open decisions

1. **Does the lens keep "a pen edit becomes a task"?** Recommended yes, through one `qsm-tasks
   add`; the in-flight `marketplace-lens` change specifies it, so whichever archives second
   reconciles.

## Critiques

- Offline, tracking stops. Waived: one path, no fallback; the skill's caveats say so.
- One login for owner and agent, so "the owner merges" is a rule, not a gate. Waived until
  `agent-identity`.
- The readers could be a second feature. Waived: removing `br` without them breaks `orient`; each
  is a removal, not a redesign.
- The epic-to-feature rename could wait. Waived: two names for one concept is the first thing a
  new reader trips on.
- The fake `qsm-tasks` could be skipped by deleting the evals. Waived: the evals prove the skills.
