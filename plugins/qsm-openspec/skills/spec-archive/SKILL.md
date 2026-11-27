---
name: spec-archive
description: "Use when a change is finished and should leave the active set, or its delta specs have to become the durable spec set: archiving a change, merging or syncing deltas, finishing the spec workflow, promoting a completed proposal. Triggers: archive this change, sync the specs, merge these spec deltas, fold the deltas in, finish this change, we are done with this change, close this out. Revising an unfinished plan is spec-propose."
---

# Spec archive

Archiving is the moment a change stops being reviewable against its intention, so every gate is
checked first. This skill merges the deltas into the durable specs and archives the change.

## Before the first check

1. **Find the root.** `openspec list --json` must work from a root that belongs to this repository.
   No root of its own: stop, offer `openspec init --tools none`.
2. **Name the change.** Pick from the list; ask only when two fit.

## Merge the deltas

A merge is reading, not copying. Delta paths come from `openspec status --change <id> --json`. No
deltas: say so, merge nothing. Per requirement:

1. **Read the whole durable spec first.**
2. **ADDED** puts it in; if it already exists it is a MODIFIED.
3. **MODIFIED** replaces the whole requirement, scenarios included.
4. **REMOVED** deletes the match; no match: say so, delete nothing near it.
5. **RENAMED** is a rename (from, to), not a delete plus an add.
6. **Untouched stays untouched:** other requirements, scenarios, order, reasoning.

## Gates, all blocking

1. Every line of tasks.md ticked. One open line: send it back to spec-apply. A plan that no longer
   matches what was built: send it to spec-propose.
2. `openspec validate <id> --strict` and `openspec validate --all --strict` pass, merge included.
3. The project's tests pass, and you hold this session's output.

A red gate stops the archive: name the exact failure and what clears it. Never pass `--no-validate`
or `--skip-specs` (the second only for a change with no deltas).

## Archive

1. `openspec archive <id> --yes` with every gate green. Confirm the change sits under the archive
   directory and is gone from `openspec list`.
2. `openspec validate --all --strict` again, because the move rewrites paths.
3. If the person named the change's issue, close it with
   `gh issue close <n> --comment "<the work done>"`. Create none.

## Say it in the reply

Per durable spec: path and actions applied. Each gate with its result. The archived path. Task ids
closed, if any.
