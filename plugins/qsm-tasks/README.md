# qsm-tasks

The task tool for an agent that must remember unfinished work between sessions, for one developer.

## Why it exists

Work that outlives a session is lost unless one place outside the conversation holds it. This
plug-in is that place for the task port: the role the planning flow names when it says "the task",
served here by `br`. It holds the model of what an epic and a task are, so every flow reads the same
one, and it keeps the tracker's name and commands in one skill so a different tracker could replace
it. It is not a project-management tool, and it would have no reason to exist if the harness kept
its own task list across sessions.

## What you get

| Kind | Name | What it does |
| --- | --- | --- |
| Skill | `task-tool` | The task model: what an epic and a task are, when each is created and closed, and the `br` commands |
| Skill | `task-writing` | How to write the text of an epic or task: skeleton, before and after, done-when, plain summary for a first-time reader |
| CLI | `qsm-tasks doctor` | Reports whether `gh`, the one program the binary needs, is on PATH |

The skill is the only place that teaches the `br` commands. A fix is a commit
only, with no epic and no task. Every epic ends with a test-it task that runs the real path.

## Install

```bash
claude plugin install qsm-tasks@qsm-marketplace
qsm-setup install qsm-tasks
```

`qsm-setup install` compiles the `qsm-tasks` binary and checks for `br`. The binary needs the
GitHub CLI, `gh`. Run `qsm-setup doctor qsm-tasks` to check both tools.

## Use

The skill loads at the start and end of a session, when work will not finish in the turn, and when
a finding is not the ask.

- ask: "what is open?" loads it, and the first command is `br ready --json`.
- ask: "track this for later" creates a task instead of a TODO in prose.
- ask: "close this epic" checks the close rule before it closes anything.

## Caveats

- The installer exits non-zero when the Rust tool `br` (`beads_rust`) is missing and prints the
  upstream install line.
- One tracker per repository: `.beads/` at the root is committed, the cache beside it is not.
