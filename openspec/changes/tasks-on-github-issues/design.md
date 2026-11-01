## Context

Today `qsm-tasks` serves the task port with `br`: a skill, an install probe and
`.beads/issues.jsonl` in git. worktrunk writes `.beads/redirect`, memory's `orient` and cockpit run
`br list`, the lens runs `br list` and `br create`, toolbox lists `br`. The skills of plan,
openspec, essentials and review already say "the task tool".

## Decisions

### 1. The skill holds who acts and when; the binary holds the names

`qsm-tasks flow` prints the options, definitions and guards, so the skill copies none of them.

| Step | Verb | Who and when |
| --- | --- | --- |
| session start | `ready`, `list --mine` | the agent, first thing |
| planning | `edit <n> --spec <change-id>`, `edit <n> --body-file <summary>` | the planning session, on the filed feature |
| a feature the owner asks for in chat | `feature "<goal>" --intent <file>` | the main agent, on the owner's word |
| split | `add "<task>" --feature <n>`, `edit <task> --after <blocker>` | the owner and the agent; the first task makes the feature In Dev |
| claim, give back, defer | `claim`, `unclaim`, `unclaim --until <date>` | the session that builds; the main agent |
| pull request open | nothing, or `review <task>` when the workflow lags or after a finding | GitHub; the builder |
| CI green, every finding fixed | `human <task>` | the builder, only then |
| task merged into `feature/<n>` | nothing: the Action closes it | the owner merges |
| last task closed | nothing: the Action updates `feature/<n>` from main, sets Ready For Test or files a conflict task | GitHub |
| decision or spec-only task | `close <task> --reason` | the main agent, on the owner's word |
| not doing it | `close <n> --not-planned --reason` | the main agent, on the owner's word |
| QA | `ready --qa`, `qa <feature>`, `add --feature <feature> "<finding>"`, `note <feature> "QA passed ..."` | the QA agent only |
| step 9 | spec-archive on `feature/<n>`, then the feature pull request | the agent, after `QA passed` |
| accept | nothing: the owner merges the feature pull request into main | the owner |
| progress | `note <id> "<text>"` | anyone, in the owner's name |
| feedback | `feedback "<title>" --area <a> --kind <k> --from <f>` | any agent; a subagent's one create |

### 2. A change is bound to its feature

The filed feature carries `change:<change-id>`; spec-propose looks it up with `list --spec` before
it writes. Tasks carry no label: they are sub-issues of the bound feature, created at the split.

### 3. QA's verdict is a note with a fixed first line

The QA agent that finds nothing posts `note <feature>` whose first line is `QA passed`, with one
line per cover scenario. No Status says it, because the agreed board has none between In Test and
Done; spec-archive reads the latest QA note and starts step 9 only on it.

### 4. The readers go, apart from one write

| Reader | Decision | Files |
| --- | --- | --- |
| worktrunk redirect | removed | `lib/task-store.ts` and its test, `StoreIo` in `lib/node-io.ts`, the call in `hooks/worktree-create.ts`, the redirect test, README |
| memory `orient` task lines | removed: session start needs no network | `lib/beads.ts`, the tracker part of `lib/orient.ts` and its tests, the `orient` description, README, the `plugin.json` dependency |
| cockpit Tasks card | removed: the board is the view | `lib/tasks.ts`, the Tasks state and CLOSE text of `lib/cockpit.ts`, the card in `hooks/register.tsx`, the `plugin.json` dependency |
| lens task reads | removed | `lib/lens/tasks.ts`, `brief.ts`, the task fields of `model.ts`, `page.ts`, `view.ts`, `serve.ts`, the `.beads` carve-out of `watch.ts` |
| lens pen edit | kept, one `qsm-tasks add` with no feature | `lib/lens/edits.ts`, `pull.ts` |
| toolbox and knip `br` | removed | `lib/catalog.ts` row, `skills/toolbox/SKILL.md`, README, root `knip.jsonc` |

Readers go first and qsm-tasks last, so every state builds; a test of a removed behaviour goes with
it. The word epic is replaced in every file `grep -rniw 'epics\?' plugins/*/skills plugins/*/agents
plugins/qsm-setup/instructions AGENTS.md README.md` finds.

### 5. Evals use a fake `qsm-tasks`

One recording stub in root `lib/fixtures/` for the evals of qsm-tasks, qsm-openspec, qsm-plan and
qsm-review; real issues per eval run would be noise on the public repository.

### 6. The instruction file names the tools

Two rows of "Where things live" change, three columns kept:

```text
| the task tool, `qsm-tasks` | what is unfinished, in what order, and who has it, never a TODO in prose; a feature holds the intent, the models and the spec of a piece of work, and a task is one pull request under it; daily verbs `qsm-tasks ready`, `list --mine`, `show <id>`, `claim <id>`, `note <id> "<text>"`, and `--help` for the rest | daily |
| the memory tool, `qsm-memory` | what a person and the model said in every earlier main session on this machine, saved by a hook and searched by full text, never acceptance criteria; plus one short-term note for the next session, which expires; daily verbs `qsm-memory search "<words>"`, `show <id>`, `note "<text>"` | never by hand, except the note |
```

## Open decisions

1. **Does the lens keep "a pen edit becomes a task"?** Recommended yes, through one `qsm-tasks
   add`; whichever of this and `marketplace-lens` archives second reconciles.

## Critiques

- Offline, tracking stops: one path, no fallback; the skill's caveats say so.
- One login for owner and agent makes "the owner merges" a rule, not a gate, until
  `agent-identity`.
