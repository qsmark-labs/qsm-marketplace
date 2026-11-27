---
name: spec-propose
description: "Use when the person asks for a change to start as a spec instead of as code, or when an existing change's plan no longer matches reality: proposing a change, writing the spec for a feature, turning a settled brainstorm into a plan, revising a proposal, or reconciling a decision that no longer holds. Triggers: propose this change, write a spec for this feature, spec this out, make it apply-ready, update the spec, the requirements changed, the implementation deviated from the plan. Never a gate in front of a fix or a plain request. Code that implements an apply-ready change is spec-apply."
---

# Spec propose

This skill writes the intention first, for the person who will review the result and the agent who
will implement it: a proposal (why), a design (where things go), delta specs (what the system will
do), and tasks.md (the breakdown of this one change: files, order, proof). The spec is the prompt
for the implementation, so what is not in it does not get built. It runs only when the person asked
for a spec; a fix or a plain request goes straight to code. Running it on an existing change
revises that plan: the four artifacts move together.

It writes planning artifacts only. It never edits code.

## Before the first artifact

1. **Check that the decisions are in hand.** Can you say from the ask what the system does
   afterwards and what proves it? A decision you can pick yourself, you pick, and the design says
   so. Only what the person alone can settle goes to the grilling skill, as one batch with your
   recommendations.
2. **Confirm the OpenSpec root belongs to this repository.** Root resolution walks up the tree, so
   a nested repository silently resolves to the ancestor's root. No root of its own: stop and offer
   `openspec init --tools none`.
3. **Pick a short kebab-case change id and check it is free.** An id in use is a question for the
   person (continue that change or rename). Create no GitHub issue the person did not ask for.

## Writing the artifacts

1. **Take the order from the CLI's status.** Write what is ready, skip what is blocked, loop until
   everything required for apply is done.
2. **Fill each artifact from its own instructions** (template, dependencies, path). Writer
   constraints in the instructions are for you, never copied in.
3. **Delta specs carry real requirements and scenarios.** A scenario title describes the behaviour
   a user or caller sees. A MODIFIED requirement keeps every scenario the current spec has, because
   the archive refuses one that drops a scenario: a scenario that must go goes by REMOVED plus ADDED
   under a new requirement name. A RENAMED `- FROM:` and `- TO:` each stays on one line.
4. **tasks.md is the breakdown of the one change, and stays in the file.** Lines are in dependency
   order: each can be shown working alone, names the files it owns and the proof that shows it. No
   line becomes a task in the task tool.

## Revising an existing change

1. **Write down what changed, why, and which decisions it invalidates, then read every artifact,
   before editing.**
2. **Revise proposal, design, delta specs and tasks as one move**, checking that tasks implement
   the design, the design satisfies the proposal, and the delta specs match the design.
3. **Reopen every tasks.md line a changed decision invalidated**, ticked ones included.
4. **Say what the revision cost**: lines reopened, work discarded.

Apply-ready is a state the artifacts prove: every required artifact done and strict validation
green.

## The gate before code

Show the person the spec and tasks.md and ask for the yes through the ask tool. Hand to spec-apply
only after it.

## Red flags

- When you opened a source file and are editing it, stop: this skill plans, and the code belongs to
  spec-apply.
- When a revision touched the proposal and you have not opened the design, open it.
- When you are about to create a task for a tasks.md line, stop: the breakdown is local.

## Say it in the reply

One line per artifact written or revised, with its path. For a revision: what changed and why,
lines reopened. Last line: apply-ready and waiting for the person's yes, or the open decisions
handed to grilling.
