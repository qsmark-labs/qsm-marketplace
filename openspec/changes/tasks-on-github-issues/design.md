## Context

Today `qsm-tasks` serves the task port with `br` (beads_rust): one skill holds the model and a table
of `br` commands, an install script probes `br`, and the tracker is `.beads/issues.jsonl` in git.
Five other plugins touch it directly: worktrunk writes `.beads/redirect` into each new workspace,
memory's `orient` runs `br show` and `br list`, cockpit runs `br list` for a card, builder's lens
runs `br list` and `br create`, and toolbox lists `br` as a tool. The skills of plan, openspec,
essentials and review already say "the task tool" and name no binary, which is the one thing that
makes this change small for them.

Feature #3 settles the direction: GitHub Issues is the main task tool, reached through the verbs of
the `qsm-tasks` binary (sibling change `qsm-tasks-cli`, which also holds the flow table, `doctor`,
`setup` and the Action `feature-ready.yml`), `tasks.md` holds the steps of one change, `br` goes,
one board per repository, a feature is an issue of GitHub's default issue type `Feature` whose
tasks (type `Task`) are sub-issues. A verb GitHub refuses fails loud and does nothing else. The
board is org Project #1 of `qsmark-labs` with one Status field that a task and a feature each use
a part of, set up by the owner (`qsm-tasks flow` prints the options and their definitions).

## Goals / Non-Goals

**Goals:**

- One answer to "which tool is the main task tool", written in one skill, with the verb for every
  step the old table covered.
- No file in the marketplace reads or writes `.beads`, or names `br`, when this is applied.
- The skills keep working in the roles they already use ("the task tool"), unchanged.

**Non-Goals:**

- The binary, its verbs, the flow table, the board, the organization: `qsm-tasks-cli` and the
  maintainer.
- Triage of the open `br` tasks and untracking `.beads/`: the migration piece, run after this.
- A replacement for the removed readers (orient lines, cockpit card, lens task list).
- Pull requests, review threads and GitLab (qsm-forge): untouched.

## Decisions

### 1. The skill is the model and the flow; the binary is `qsm-tasks-cli`'s

The `task-tool` skill keeps its model rules (the fourth, the test-it task, becomes the QA test;
see decision 3) and the working rules, and its `br` table becomes the verbs of `qsm-tasks`. The
plugin gains no code here: the binary, `qsm.json`, the install and `doctor` come from
`qsm-tasks-cli`, and this change deletes the `br` text and the old install probe's remnants. The
plugin declares no plug-in dependency. The contract other plugins use is unchanged: they say "the
task tool" and the skill is the one place that names verbs. The old requirement "One skill names br"
becomes "One skill names the verbs", the same ownership with the new tool.

The skill says what the binary cannot: who acts and when. `qsm-tasks flow` prints the names, the
definitions and each verb's guard from the binary's own table, so the skill copies none of them (a
renamed option edits one file), and holds the table below.

| Step | Verb | Who and when |
| --- | --- | --- |
| session start | `qsm-tasks ready`, `qsm-tasks list --mine` | the agent, first thing: the two lists are the old ready list |
| feature | `qsm-tasks feature "<goal>" --intent <file>` | the main agent after grilling, with the person's yes |
| task of a change | `qsm-tasks add "<change>" --feature <id> --spec <change-id>` | spec-propose, once the spec is written, never before |
| order | `qsm-tasks after <task> <blocker>` | the planner |
| claim | `qsm-tasks claim <task>` | the agent that builds; spec-apply at start |
| give back | `qsm-tasks unclaim <task>` | the agent that cannot continue |
| pull request open, CI and review agents running | `qsm-tasks review <task>` | the builder, when it opens the pull request |
| CI green, every finding fixed | `qsm-tasks human <task>` | the builder, only then; the owner tests and approves |
| merge | nothing: `Closes #N` closes the task, the board sets Done | the owner merges |
| decision or spec-only task | `qsm-tasks close <task> --reason` | the main agent with the owner's word |
| not doing it | `qsm-tasks drop <n> --reason` (a task, or a feature with no open task) | the main agent with the owner's word |
| feature ready for QA | nothing: the Action sets Ready For Test; `qsm-tasks ready --qa` lists it | GitHub; the QA agent reads the list |
| QA takes the feature | `qsm-tasks qa <feature>` | the QA agent only |
| QA finds something | `qsm-tasks finding <feature> "<title>"` | the QA agent only |
| QA finds nothing | report to the owner; the Status stays In Test | the QA agent |
| owner accepts | `qsm-tasks accept <feature>` | only on the owner's explicit word in the conversation |
| owner rejects | `qsm-tasks finding <feature> "<reason>"` | only on the owner's explicit word |
| progress | `qsm-tasks note <id> "<text>"` | anyone, in the owner's name |
| work for later | `qsm-tasks defer <id> --until <date>` | the main agent |
| feature check | `qsm-tasks tree <feature>`, `qsm-tasks show <feature>` | after each task closes |
| feedback | `qsm-tasks feedback "<title>" --area <a> --kind <k> --from <f>` | any agent, a subagent's one permitted create |

Alternative rejected: keep `task-tool` free of verb names and point at the binary's own help. The
agent would learn the flow from two places; one skill that names its verbs is one place to read.

### 2. Binding a change to its task: a first line in the body

`br` had an external-reference field; an issue does not. The task for a change carries the first
body line `openspec: <change-id>`, written by `qsm-tasks add --spec` or `spec` and read by
`find-spec`, which filters for the exact first line. spec-propose runs `find-spec` before it creates
anything. The exactness proof and the fallback to a label are the binary's (`qsm-tasks-cli` design
6 and its task 0.3), so this change adds no proof of its own and the skill relies on the verb.

### 3. One Status, a part of it for each kind, and QA instead of test-it

A task's flow is Todo, In Dev, Agent Review, Human Review, Done. The owner tests tasks himself,
with automatic tests and the review agents, so no agent sits between a task and him and a task
needs no QA. A task closes by the merge of a pull request with `Closes #N`, and the board's "Item
closed" sets Done; a task whose work has no pull request (a decision) is closed with the explicit
`close` verb and a reason a reader in a month understands, and work that will not be done is
`drop`ped with a reason and ends Canceled.

A feature's flow uses the same field: Todo while planned, In Dev from its first claimed task
(`claim` does it), Ready For Test when its last sub-issue closes (an Action, or `qa` straight from
In Dev when every task is closed, the owner's two routes), In Test when the QA agent takes it,
Blocked when a finding, the owner's rejection included, puts a fix task under it, and the fix task
closing sends it back to Ready For Test by the same Action. The owner accepts the QA result, and
only then is the feature closed and Done. A feature needs no review: it has the test. The agent
never closes a feature on its own word.

This replaces the final test-it sub-issue. Reason: test-it was a task made to look like a stage, it
had to be blocked by every other task by hand, and it could be ticked by the same agent that built
the feature. A step with its own agent, one that did not build the work and tests against the
business request and the acceptance criteria on the real path, is a stronger proof and costs no
per-feature issue. The QA agent runs in a Claude Code session on the owner's machine for now and on
a dedicated machine later; it is not built here, this change only states what the skills say about
it. Everything the skills post to GitHub is written in the owner's name and names no agent.

### 4. Deferred work is a label and a comment, not a status

GitHub issues have open and closed only; a board column could say `Deferred`, but the board is a
view the maintainer owns. The rule is one label `deferred` and a comment that holds the date or
condition, and the ready list excludes the label. A task is never silently closed or left open.

### 5. Feedback is filed by a verb into an issue type of its own

The instruction file and the web-research agent name the verb `qsm-tasks feedback --area <a>
--kind <k> --from <f>`, never an issue number or a title: a number in an instruction file is the
literal that goes stale (the `qsm-i1u` it replaces). The verb files an issue of the type `Feedback`
in the marketplace repository (the checkout `QSM_MARKETPLACE` names, so a subagent in another
project does not file into that project), labelled `area:`, `kind:` and `from:`, comments on an
open issue with the same title instead of making a second, and refuses personal or system data and
a suggested fix. The rule in the instruction file keeps the label for who noticed (`from:`), names
the area, the kind and the body sections (what happened, expected behaviour, context), and says
when to file; what the verb checks is `qsm-tasks-cli`'s (its design decision 14). A subagent
creates only this kind of issue.

### 6. The readers outside qsm-tasks go, apart from one write

| Reader or writer | Decision | Reason |
| --- | --- | --- |
| worktrunk `.beads/redirect` | removed | the store is on GitHub, a workspace has nothing to point at |
| memory `orient` task lines | removed (question 1) | session start must not need the network |
| cockpit Tasks card, `tasks` verb | removed (question 2) | a polled network read; GitHub's board is the view |
| lens open-task reads | removed (question 3) | same reason as the card |
| lens pen edit | kept, through `qsm-tasks add` (no feature) | it is a write of one loose task, the same verb the skill uses |
| toolbox `br` row, knip `br` | removed | no `br` |

Removing a reader removes its dependency on qsm-tasks (memory, cockpit). The lens keeps it, for the
one write.

### 7. Order of work

Readers first, qsm-tasks last. `br` stays usable until nothing calls it, so every intermediate state
builds and every test that passed before still passes. Each reader removal is also the place its
test is deleted or rewritten: a test of a removed behaviour is removed with it, never kept green by
a fake `br`.

### 8. Evals use a fake `qsm-tasks`

The evals of qsm-tasks (`task-tool-last-child-of-epic`, whose grader reads `.beads/issues.jsonl`),
qsm-openspec, qsm-plan and qsm-review scaffold a repository with `br init` and `br create`. They get
a `qsm-tasks` stub on PATH that records its arguments to a file and prints a canned answer for the
reads (`ready`, `list`, `show`, `find-spec`); the graders read that file. The real verbs against
real GitHub are proved once by `qsm-tasks-cli` and by the feature's QA test. Alternative: real
`test:` issues per eval run, rejected as noise on the public repository (question 4).

### 9. The instruction file names the tools, in the same three columns

`plugins/qsm-setup/instructions/CLAUDE.md`, table "Where things live", is the one place an agent
learns on every task which binary serves a role; skills and agents keep saying "the task tool". The
table keeps its three columns (Place, Answers, Changes): a fourth column for verbs would be empty on
five of the seven rows, and the daily verbs fit the Answers cell of the two rows that have them. Two
rows change, verbatim:

```text
| the task tool, `qsm-tasks` | what is unfinished, in what order, and who has it, never a TODO in prose; a feature holds the intent and acceptance criteria of a piece of work and a task is one spec change under it; daily verbs `qsm-tasks ready`, `list --mine`, `show <id>`, `claim <id>`, `note <id> "<text>"`, and `--help` for the rest | daily |
| the memory tool, `qsm-memory` | what a person and the model said in every earlier main session on this machine, saved by a hook and searched by full text, never acceptance criteria; plus one short-term note for the next session, which expires; daily verbs `qsm-memory search "<words>"`, `show <id>`, `note "<text>"` | never by hand, except the note |
```

The row in group 10 of tasks.md replaces the two existing rows `the task tool` and `the session
archive (qsm-memory)`; the sentence "never by hand, except the note" stays the Changes cell of the
memory row.

## Risks / Trade-offs

- **Offline, tracking stops.** One path, no fallback. The skill's caveats say so.
- **The verb names come from `qsm-tasks-cli`.** Group 1 of tasks.md reads that change as applied
  and fixes any name that moved; the spec's scenarios describe results, not flags.
- **`marketplace-lens` is an active change** whose requirement "An edit becomes one task in the task
  tool" is not in the main spec yet. If it archives first, this change modifies it; if not, its
  tasks 3.3 and its design 14 are reconciled when it is applied. Recorded in tasks.md.
- **A rate limit or a missing `project` scope** surfaces as the verb's failure with the cause; the
  skill names `gh auth refresh -s project` as the fix.

## Migration Plan

This change adds no data migration. The 98 `br` tasks become issues in the migration piece, which
needs the `.beads/` file readable until it finishes, so `.beads/` and the `br` binary stay on the
maintainer's machine until the triage is confirmed. Group 12 of tasks.md, the sweep that confirms
nothing names `br`, is applied after that. Nothing here deletes `.beads/` itself.
