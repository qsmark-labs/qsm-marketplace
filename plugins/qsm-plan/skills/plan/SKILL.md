---
name: plan
description: "Use when the person asks for a plan or a sizing: a fix, a feature, a plugin change, a restructure, or a project that will span sessions; and when an epic exists and must be split into tasks. Triggers: plan this, naplanuj, spec this out, break this down, split this epic, help me design this, how big is this, what do we build first, chci udelat projekt, /plan. Sizes the ask as a fix or an epic, routes a fix to a commit and an epic through grilling, then splits the epic into tasks. Writes no code and no note. Never a gate in front of a plain request. Settling open decisions is grilling."
---

# Plan

Most asks arrive at the wrong size: a five-line fix dressed as a project, or a project dressed as a
question. This skill runs only when the person asked for a plan or a sizing. It sizes the ask and
starts it at its right depth and no deeper. A plain request to do something is not a request for a
plan: do it.

Work is named in roles: "the task tool" holds epics and tasks, "the spec tool" holds the specs. If
a role has no plug-in installed, stop with `missing` and name what to install: qsm-tasks for the
task tool, qsm-openspec for the spec tool.

## Take the ask in

Read the ask first. Look elsewhere only for what the ask does not say:

| Question | When the ask does not answer it, where to look |
| --- | --- |
| Why are we doing it? | memory |
| Does something already cover it? | the task tool, the spec tool |
| Where is it, what does it touch? | code |
| How is this kind of thing built here? | the project's `AGENTS.md` or `CLAUDE.md` |

A small ask is one where the text answers all of them: restate it in one line with its size and
start. A decision already in memory is settled; carry it. An open task with the same words is named
to the person first. Library documentation or the web is not searched for a fix.

## Size the ask

| Size | The test | Route |
| --- | --- | --- |
| fix | the decision is settled and needs no design | implement and commit, the why in the message; no epic, no task, no spec |
| epic | anything larger that the person asked to plan | grilling writes the epic, then this skill splits it |

A restructure of how parts fit together is an epic even when it sounds small, because its cost is
the decisions, not the lines. A second sizing round with no new facts is fog: name the open
decisions and go to grilling.

## Split an epic

Needs an epic with its intent and acceptance criteria. If the criteria are missing, go back to
grilling; splitting guesses what done means.

1. **Cut pieces that are demoable alone**, in dependency order, each small enough for one change.
   Name each piece with the criteria it serves.
2. **Show the person the pieces** and wait for the yes before any code.
3. **Hand each piece to spec-propose** only when the person wants a spec for it; otherwise each
   piece is a task.

## Say it in the reply

One line naming the size and the route: "epic, going to grilling for the intent and the criteria".
Before it, the one line a search produced if there was one. After a split, the pieces as a list, one
line each. No plan document in chat.
