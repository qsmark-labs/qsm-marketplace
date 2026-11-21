## Build order

Each line can be shown working alone; the proof is the run named after it.

- [ ] 1. `subgraph`: the base by merge base, the touched set from the `bpmn` kind's diff in qsm-bpmn
      and from qsm-c4's own diff by element id and relation in qsm-c4, one hop, `--widen`. Files:
      `lib/subgraph.ts`, `qsm.json` and `scripts/cli.ts` of `plugins/qsm-bpmn/` and of
      `plugins/qsm-c4/`. Proof: a `runBin` test on a `lib/fixtures/git.ts` repo whose branch adds
      one step to a process. Blocked by models-pages line 1.
- [ ] 2. The pictures: one layout of the union, before red, after green, the legend, nothing
  written when untouched. Files: `lib/subgraph.ts`, `lib/bpmn/`, `lib/c4/`. Proof: the two pictures
  of the fixture read as PNG, the element in the same place in both. Blocked by 1.
- [ ] 3. spec-apply links the pictures in the PR body and on the bound task; the feature schema's
  models artifact and template become the subgraph pictures. Files:
  `plugins/qsm-openspec/skills/spec-apply/`, `skills/spec-propose/`, `openspec/schemas/feature/`.
  Proof: `bun run eval qsm-openspec`, then one real PR of a change that touches a process. Blocked
  by 2.
