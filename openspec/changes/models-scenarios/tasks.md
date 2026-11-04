## Build order

Each line can be shown working alone; the proof is the run named after it.

- [ ] 1. The kind `cucumber`: its converter and manifest. Files: `plugins/qsm-models/lib/kinds/`,
  `scripts/install.ts`. Proof: a report recorded from a real feats run with
  `FEATS_REPORTERS=cucumber-json:<file>` stored and converted; a JUnit file refused. Blocked by
  models-pages line 1 and the owner's answer to design decision 1.
- [ ] 2. The path list on the BPMN page: each path's scenarios and results, uncovered, the
      highlight. Files: `plugins/qsm-models/pages/bpmn/`, `lib/scenarios.ts`. Proof: a scripted
      browser run on a graph with one passing, one failing and one untagged path. Blocked by 1 and
      models-pages line 2.
- [ ] 3. The skill `model`: tag a scenario with its path, run with the Cucumber JSON reporter,
  store the report. Files: `plugins/qsm-models/skills/model/`. Proof: `bun run eval qsm-models`.
  Blocked by 1.
