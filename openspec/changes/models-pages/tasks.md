## Build order

Each line can be shown working alone; the proof is the run named after it.

- [ ] 1. `convert bpmn`, `diff bpmn`, the `bpmn` manifest installed by `scripts/install.ts`.
  Files: `plugins/qsm-models/lib/kinds/`, `qsm.json`, `scripts/install.ts`. Proof: `qsm-docs create
  bpmn models/marketplace.bpmn`, a copy with a step's Gherkin changed created with `--parent`, and
  `qsm-docs diff` prints one `changed` line naming the step.
- [ ] 2. `gherkin <graph> [--task <id>]`. Files: `plugins/qsm-models/lib/gherkin.ts`, `qsm.json`.
  Proof: the compiled binary prints a step's scenarios from a file and from a snapshot id, and
  fails naming a step without any. Blocked by 1 for the snapshot form.
- [ ] 3. The BPMN page as the kind's page: the first build's page reading `/api/snapshots/<id>`,
  the details panel with the Gherkin field in edit mode, save as a full XML proposal. Files:
  `plugins/qsm-models/pages/bpmn/`. Proof: design Verify 1, then a scripted browser run that drills
  into a called process, writes two scenarios under a step, saves, and `qsm-docs list --open` names
  the proposal; no new connection leaves 127.0.0.1. Blocked by 1.
- [ ] 4. Apply: the skill `model` says how to apply a `bpmn` proposal (diff, copy the scenarios,
  gates, commit, the applied snapshot with `--parent`). Files: `plugins/qsm-models/skills/model/`.
  Proof: a real apply of the proposal from line 3, then `qsm-models gherkin` prints the scenarios
  from `models/marketplace.bpmn`. Blocked by 2, 3.
