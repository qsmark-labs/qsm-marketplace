---
name: task-tool
description: "Use when the person asks what is open or what is next, or asks to track, claim, close or check an epic or a task, or when a subagent reports a tool problem. Triggers: what next, what is open, track this, epic, acceptance criteria, blocked by, depends on, claim this, close this, file feedback, co dal, zaloz task. Holds the commands of the one tracker. Never creates a task, a follow-up or an epic nobody asked for, and is never a gate in front of a plain request."
---

# Task tool

The task tool is the one place that holds work across sessions and agents. This skill holds the
model of an epic and a task and the commands of the one binary that serves it, `br`. It runs when
the person asks about, or for, tracked work. It does not decide what to build, and it does not make
the agent file anything the person did not ask for.

## The model

1. An epic holds the intent of one piece of work and its acceptance criteria: who it is for, what
   they do with it, what is out, and the checks that prove it.
2. A task is one piece of work under an epic or alone. A change in the spec tool carries its task
   by the external reference `openspec:<change-id>`. No subtasks: the change's `tasks.md` holds
   the steps.
3. A fix gets no task and no epic: a commit with its why in the message.
4. Create a task only when the person asks for one. A finding that is not the ask is one sentence
   in the reply, not a task.
5. A task closes with a reason a reader in a month understands. When the work on a task is done,
   close it. An epic closes when every task is done and every acceptance criterion holds.

## Working rules

1. Starting a task claims it; progress worth keeping goes into its comments.
2. One tracker per repository. A worktree points at the main checkout's store.
3. The main agent creates tasks. A subagent creates one kind: feedback into the marketplace
   tracker, where the instructions say.
4. Before creating, search the title words and comment on an existing task instead.

## The binary: `br`

`br` is the Rust beads tracker (`beads_rust`), not `bd`, the Go tool of the same family. The store
is `.beads/` at the repository root: `issues.jsonl` is the tracked source of truth and `beads.db` is
a cache `br` rebuilds. Commit `.beads/`, never the cache. Add `--json` when a program reads the
result. Tasks are read and written only through `br` and read as a graph through `bv --agents`:
never a script, never `bd`, never a hand edit of `issues.jsonl`.

| Step | Command |
| --- | --- |
| start | `br ready --json` |
| epic | `br create "<goal>" -t epic -d "<intent and acceptance criteria>"` |
| spec change | `br create "<change>" -t task --parent <epic> --external-ref openspec:<change-id> -d "<why>"`; find it with `br list --json` on `external_ref` |
| other task | `br create "<title>" -t task -d "<why and what done looks like>"` |
| order | `br create ... --deps blocks:<id>` or `br dep add <task> <blocker>` |
| finding | `br create ... --deps discovered-from:<id>` |
| claim | `br update <id> --claim` |
| progress | `br comments add <id> "<what changed>"` |
| who | `br coordination status --json` |
| close a task | `br close <id> --reason "<what was done>"`, then `br sync --flush-only`, then `git add .beads/` |
| epic check | `br epic status`; when the criteria also hold, `br close <epic> --reason "<what it delivered>"`, then flush |
| defer | `br update <id> --status deferred --defer <date>` |
| hygiene | `br stale --days 30`, `br list -s open --json`, `br show <id> --json` |
| worktree | write the main checkout's `.beads` path, absolute, as the single line of `<worktree>/.beads/redirect` |
| duplicate id after a git merge | take the other side's file, `git checkout <their commit> -- .beads/issues.jsonl`, then `br sync --merge --force-jsonl`, then `br create` again for each of yours it dropped |

`br epic status` reports an epic eligible when its children are closed; read the criteria yourself.
With a redirect, `br sync` in the worktree only exports; the main checkout owns the commit. A fresh
repository gets `br init` once, then `br config set issue_prefix=<short>`.

## Say it in the reply

For "what next": the ready list's top three with their blockers, not the whole tracker. After
work on a tracked task: ids closed with reasons.
