# qsm-tasks

The task tool for an agent that must remember unfinished work between sessions, for one developer.

## Why it exists

Work that outlives a session is lost unless one place outside the conversation holds it. This
plug-in is that place for the task port: the role the planning flow names when it says "the task",
with a CLI and shared guidance for writing and closing tasks. It holds the model of what an epic
and a task are, so every flow reads the same one.

## What you get

| Kind | Name | What it does |
| --- | --- | --- |
| Skill | `task-tool` | The task model: what an epic and a task are, when each is created and closed, and the `br` commands |
| Skill | `task-writing` | How to write the text of an epic or task: skeleton, before and after, done-when, plain summary for a first-time reader |
| CLI | `qsm-tasks doctor` | Reports whether `gh`, the one program the binary needs, is on PATH |
| CLI | `qsm-tasks list` | Lists the open issues of the repository with their Status on the board |
| CLI | `qsm-tasks add` | Files an issue from a body file, optionally as a sub-issue of another |

The skill is the only place that teaches the `br` commands. A fix is a commit
only, with no epic and no task. Every epic ends with a test-it task that runs the real path.

## Install

```bash
claude plugin install qsm-tasks@qsm-marketplace
qsm-setup install qsm-tasks
```

`qsm-setup install` compiles the `qsm-tasks` binary. Run `qsm-setup doctor qsm-tasks` to check
that the binary can find the GitHub CLI, `gh`.

## Existing skill workflow

The skill loads at the start and end of a session, when work will not finish in the turn, and when
a finding is not the ask.

- ask: "what is open?" loads it and lists ready work.
- ask: "track this for later" creates a task instead of a TODO in prose.
- ask: "close this epic" checks the close rule before it closes anything.

## Caveats

- Install and health checks work without `br`. The retained `task-tool` skill's existing tracker
  commands still need it. Migration of tracker calls across the marketplace is tracked in
  [#6](https://github.com/qsmark-labs/qsm-marketplace/issues/6).
