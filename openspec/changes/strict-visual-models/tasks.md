## Build order

No `tasks.md` existed before the revision of 2026-11-04, so no line was reopened. Each line can be
shown working alone; the proof is the run named after it.

- [ ] 1. Verify 2, 4 and 6 of the design: bpmnlint in a compiled binary, `likec4 validate` from the
  binary, a `qsm:` attribute kept by bpmn.io. Files: a scratch prototype, none in the tree. Proof:
  each verdict written into the design. Blocks 3 and 4.
- [ ] 2. The plugin: README, `plugin.json` with the dependency on qsm-docs, `qsm.json` with the five
  verbs, the installer. Files: `plugins/qsm-models/**`. Proof: `bun run validate`. Blocked by
  qsm-docs line 1.
- [ ] 3. `lint` for BPMN: bpmnlint recommended and our rules as a bpmnlint plugin, Method and
  Style, the backtick rule. Files: `plugins/qsm-models/lib/bpmn/`. Proof: a `runBin` test on the
  migrated graph and one fixture per rule. Blocked by 1, 2.
- [ ] 4. `lint` for C4: `likec4 validate`, the vocabulary, the level rules, level 3 optional.
  Files: `plugins/qsm-models/lib/c4/`. Proof: a test on `marketplace.c4` and the container-in-a-
  container fixture. Blocked by 1, 2.
- [ ] 5. `layout`, `render` and `render --check` on the one graph, the colour rule, the layout
  hints. Files: `lib/bpmn/`, `lib/c4/`, `lib/c4/drawio.ts`. Proof: design Verify 5, then the same
  bytes on two renders, and the pictures read as PNG. Blocked by 3, 4.
- [ ] 6. `paths` per process, `--process`, `--compare`, `--specs`. Files: `lib/paths.ts`. Proof:
  the cover of every migrated process equals the measured one. Blocked by 3.
- [ ] 7. `check`: model files outside `models/`, the code check, the four links, the verified
  commit, another project through `qsm-docs list`. Files: `lib/conform.ts`, `lib/links.ts`. Proof:
  design Verify 1, then one fixture per broken link kind. Blocked by 4, 6.
- [ ] 8. The migration of the marketplace's models into `models/marketplace.bpmn` and
  `models/marketplace.c4`, the scenarios re-cited, the proposals' links rewritten, the old files
  deleted. Files: `models/`, `openspec/changes/*/models/`, the cited specs. Proof: `paths --compare`
  per old process, `paths --specs openspec/changes` ok, `check` ok. Blocked by 5, 6, 7.
- [ ] 9. The commit gate: the checker registry runs `lint`, `render --check` and `check` on staged
  `.bpmn`, `.c4` and `.feature` files. Files: `plugins/qsm-langdev/`. Proof: a commit of a stale SVG
  refused. Blocked by 7.
- [ ] 10. spec-propose and spec-archive: a change edits the one graph and archives no model, the
  feature schema's models instruction and template. Files: `plugins/qsm-openspec/skills/`,
  `openspec/schemas/feature/`. Proof: `bun run eval qsm-openspec`. Blocked by 8.
- [ ] 11. The skill `model`, `model-reviewer`, `model-simplifier`. Files:
      `plugins/qsm-models/skills/`, `agents/`. Proof: `bun run eval qsm-models`. Blocked by 8.
