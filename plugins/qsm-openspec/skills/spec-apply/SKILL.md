---
name: spec-apply
description: "Use when an apply-ready change is about to become code: implementing a proposal, working through a change's tasks, or starting to code a planned change. Triggers: apply this spec, implement the proposal, work through the tasks, start coding this change, build what we specced. Writing or revising the plan is spec-propose."
---

# Spec apply

The plan is written and the person said yes to it. This skill implements an apply-ready change line
by line, smallest change, real run, and adds nothing the spec did not ask for. It stops the moment
the plan stops being true. It does not rewrite the plan (spec-propose does). Follow the language
skill for the code and tick each line in tasks.md as it lands and nowhere else.

## Before the first edit

1. **Find the root.** `openspec list --json` must work from a root that belongs to this repository.
   No root of its own: stop, offer `openspec init --tools none`.
2. **Name the change.** Unnamed or ambiguous: pick from the `openspec list --json` output; ask only
   when two fit.
3. **Refuse a draft.** `openspec status --change <id> --json` must show every required artifact
   done.
4. **Read before coding.** `openspec instructions apply --change <id> --json` lists the files:
   tasks.md is the order, delta specs the acceptance, design the why.

Work inline. Subagents only for disjoint, fully decided tasks.

## Per line of tasks.md

1. **Smallest change that does the task.**
2. **Run the delta spec's scenario the way the user meets it** and read the output.
3. **Tick the line in tasks.md** after its proof ran.

## When the plan stops being true

1. **Fix and record:** a bug blocking the line, a missing validation, a mechanical blocker. Nothing
   else is yours to decide.
2. **A default, threshold, ordering or schema field the spec did not name is not a quick fix.**
3. **A refuted assumption stops the code.** Route the change through spec-propose, resume when
   `openspec validate <id> --strict` is green.
4. **An out-of-scope idea is mentioned in the reply, never coded.**

## Finishing

Done is: all lines ticked, the project's tests green, `openspec validate <id> --strict` green.
Report it; review and push when the person asks.

## Say it in the reply

Per line: ticked with its proof, or open with what is missing. One line per deviation. Last line:
done, or the blocker.
