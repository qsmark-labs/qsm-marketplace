# qsm-tasks

The task tool for an agent that must remember unfinished work between sessions, for one developer.

## Why it exists

Work that outlives a session is lost unless one place outside the conversation holds it. This
plug-in is that place for the task port: the role the planning flow names when it says "the task".
Its skills hold the model of what a piece of work is, so every flow reads the same one, and its
binary `qsm-tasks` is the agent's one door to GitHub issues and the board, so no agent composes a
`gh`, `jq` or GraphQL call itself. It is not a project-management tool, and it would have no reason
to exist if GitHub's own CLI kept the flow of a task.

## What you get

| Kind | Name | What it does |
| --- | --- | --- |
| Skill | `task-tool` | The task model: what an epic and a task are, when each is created and closed, and the `br` commands |
| Skill | `task-writing` | How to write the text of an epic or task: skeleton, before and after, done-when, plain summary for a first-time reader |
| Binary | `qsm-tasks` | Nineteen verbs over GitHub issues and the board; `qsm-tasks --help` lists them |

The skills still drive `br` until they move to the binary; the binary's verbs land one at a time,
and a verb not built yet says so and names its issue.

## Install

```bash
claude plugin install qsm-tasks@qsm-marketplace
qsm-setup install qsm-tasks
```

`INSTALL.md` has the detail; `USAGE.md` has the verbs' outcomes.

## Use

The skill loads at the start and end of a session, when work will not finish in the turn, and when
a finding is not the ask.

- ask: "what is open?" loads it, and the first command is `br ready --json`.
- ask: "track this for later" creates a task instead of a TODO in prose.
- ask: "close this epic" checks the close rule before it closes anything.

## Caveats

- `br` is the Rust tool `beads_rust`, not `bd`. The check exits non-zero when it is missing and
  prints the upstream install line. That is the report, not a failed install.
- One tracker per repository: `.beads/` at the root is committed, the cache beside it is not.
- `qsm-tasks` needs `gh` on PATH with a login that has the `project` scope.
