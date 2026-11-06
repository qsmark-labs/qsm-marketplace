## Context

The structure is the Subgraph components of qsm-bpmn and qsm-c4 in `models/marketplace.c4`; the
behaviour is `pr_pictures_process` of `models/marketplace.bpmn`. It reads the base and the branch
graph as `strict-visual-models` keeps them, diffs them with the kinds of `models-pages`, and draws
with the renderer of `strict-visual-models`.

## Decisions

1. **Diff the model, not the drawing** (research 2026-11-04, "idea most worth taking"). Options: an
   image diff of two pictures, a text diff of the source, a model diff drawn once. Choice: the model
   diff of `models-pages` (bpmn-js-differ for BPMN, ours for C4), then one renderer for both sides.
   Reason: an image diff marks every shifted pixel, a text diff is unreadable to a reviewer.
2. **One layout of the union, two pictures.** Options: lay out before and after apart, one picture
   with both, one layout drawn twice. Choice: one layout of the union of both subgraphs, drawn once
   with the before's elements and once with the after's. Reason: an element keeps its place, so the
   eye matches the two; one combined picture puts removed and added on top of each other.
3. **The base is the merge base with the target.** Options: the target's tip, the merge base.
   Choice: the merge base, so commits that land on main while the PR is open are not shown as the
   change's. In local mode the base is the newest snapshot on the base branch older than the
   branch's first snapshot.
4. **One hop by structure.** In BPMN a hop is one sequence flow or one call activity to the called
   process's start; in C4 one relation, and each drawn element's parents as boundaries. Reason: the
   epic's "one hop"; a boundary drawn without its children keeps the level readable.
5. **The pictures are committed in the change.** Options: attached to the PR only, committed.
   Choice: committed under the change's `models/`, linked from the PR by path. Reason: the schema's
   models artifact is the change's pictures, and an attachment dies with the PR page.

## Critiques

The three critique passes are in the proposal, under `## Critiques`.
