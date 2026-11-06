## Build order

Each line can be shown working alone; the proof is the run named after it.

- [ ] 1. `convert` and `diff` for `bpmn`, `c4` and `c4-change`, and the three manifests installed by
  `scripts/install.ts`. Files: `plugins/qsm-models/lib/kinds/`, `qsm.json`, `scripts/install.ts`.
  Proof: design Verify 1, then `qsm-docs create` and `diff` on the marketplace graph after a rename,
  a move and a comment. Blocked by qsm-docs line 3 and strict-visual-models line 8.
- [ ] 2. The BPMN page: the first build's viewer page grown into the modeler, the lane rules, call
      activities and the breadcrumb, another project on main, save as a full XML proposal. Files:
      `plugins/qsm-models/pages/bpmn/`. Proof: a scripted browser run that drags a task across
      lanes, drills into a called process, saves, and records only 127.0.0.1 requests. Blocked by 1.
- [ ] 3. The C4 page: the levels, the boundary rule, the verified count, save as a `c4-change`.
  Files: `plugins/qsm-models/pages/c4/`. Proof: design Verify 2, then a scripted run that moves
  qsm-docs, drags a container out of its system, and saves. Blocked by 1.
- [ ] 4. Apply: the skill `model` gains how to apply a `bpmn` and a `c4-change` proposal, the move
  as layout hints, and the snapshot after the commit; the page says when the checkout is newer.
  Files: `plugins/qsm-models/skills/model/`, `pages/`. Proof: a real apply of a saved move, then
  `render` draws it where it was put. Blocked by 2, 3.
- [ ] 5. Gherkin notes: the details page of a task with a text field in edit mode, saved into the
  task's `documentation` (`textFormat` `text/x-gherkin`) with the proposal, and the verb `gherkin
  <graph> [--task <id>]`. Files: `plugins/qsm-models/lib/gherkin.ts`, `pages/bpmn/`, `qsm.json`.
  Proof: a scripted browser run writes two scenarios under a task, saves, the agent applies it,
  `qsm-models gherkin models/marketplace.bpmn --task <id>` prints them, and `qsm-docs diff` names
  the task as changed. Blocked by 2.
