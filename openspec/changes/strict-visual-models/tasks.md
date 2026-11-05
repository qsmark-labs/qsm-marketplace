## Build order

The change is built in two stages, marked on each line: **first build** is what the owner sees first
(design decision 22), **waits** is built after he has looked at the pages. Each line can be shown
working alone; the proof is the run named after it. The revision of 2026-11-05 reopened lines 1, 2,
5, 6, 7, 8 and 9 and added lines 12 and 13; no line was ticked. A line with a waiting part stays
open and its first-build part says `(done)` once it is built.

- [ ] 1. Verify 2, 4 and 6 of the design: bpmnlint in a compiled binary, `likec4 validate` from the
      binary, a `qsm:` attribute kept by bpmn.io. Files: a scratch prototype, none in the tree.
      Proof: each verdict written into the design. Blocks 3 and 4. **First build (done):** Verify 2
      and 4, and Verify 7 ahead of line 12. **Waits:** the modeler half of Verify 6 (models-pages).
- [ ] 2. The plugin: README, `plugin.json`, `qsm.json` with the verbs, the installer. Files:
      `plugins/qsm-models/**`. Proof: `bun run validate`. **First build (done):** repo mode only,
      `plugin.json` with no dependency, so no wait on qsm-docs line 1. **Waits:** the dependency on
      qsm-docs, line 13.
- [ ] 3. `lint` for BPMN: bpmnlint recommended and our rules as a bpmnlint plugin, Method and
  Style, the backtick rule. Files: `plugins/qsm-models/lib/bpmn/`. Proof: a `runBin` test on the
  migrated graph and one fixture per rule. Blocked by 1, 2. **First build.**
- [ ] 4. `lint` for C4: `likec4 validate`, the vocabulary, the level rules, level 3 optional.
  Files: `plugins/qsm-models/lib/c4/`. Proof: a test on `marketplace.c4` and the container-in-a-
  container fixture. Blocked by 1, 2. **First build.**
- [ ] 5. `layout`, `render` and `render --check` on the one graph, the colour rule, the layout
      hints. Files: `lib/bpmn/`, `lib/c4/`, `lib/c4/drawio.ts`. Proof: design Verify 5, then the
      same bytes on two renders, and the pictures read as PNG. Blocked by 3, 4.
      **First build (done):** `layout` and `render` without layout hints. **Waits:** the hints and
      Verify 5.
- [ ] 6. `paths` per process, `--process`, `--specs`, `--compare`. Files: `lib/paths.ts`. Proof: the
  cover of every migrated process equals the measured one. Blocked by 3.
  **First build (done):** `paths` without `--compare`. **Waits:** `--compare`.
- [ ] 7. `check`: model files outside `models/`, the code check, the links, the verified commit,
  another project through `qsm-docs list`. Files: `lib/conform.ts`, `lib/links.ts`. Proof: design
  Verify 1 and the moddle half of Verify 6, then one fixture per broken link kind. Blocked by 4, 6.
  **First build:** model files outside `models/`, and the links that exist in it: a task to a C4
  element, a node to a design decision (`design:<repo path>#<n>`, a numbered item) or a commit.
  **Waits:** the verified commit, the code check against dependencies and its generated import
  rules, links to other projects.
- [ ] 8. The migration of the marketplace's models into `models/marketplace.bpmn` and
      `models/marketplace.c4`: the fourteen BPMN files named in design decision 20 and the C4
      source, the scenarios re-cited, the proposals' links rewritten, the old files deleted. Files:
      `models/`, `openspec/changes/*/models/`, the cited specs. Proof: the signatures of each old
      process, read with `paths --all` from the old file before it is deleted, all found in the one
      graph (`--compare` waits), `paths --specs openspec/changes` ok, `check` ok. Blocked by 5, 6,
      7. **First build.**
- [ ] 9. The commit gate: the checker registry runs `lint`, `render --check` and `check` on staged
  `.bpmn` and `.c4` files, and `plugin.json` of qsm-langdev declares `qsm-models`. Files:
  `plugins/qsm-langdev/`. Proof: a commit of a stale SVG refused. Blocked by 7. **Waits.**
- [ ] 10. spec-propose and spec-archive: a change edits the one graph and archives no model, the
  feature schema's models instruction and template. Files: `plugins/qsm-openspec/skills/`,
  `openspec/schemas/feature/`. Proof: `bun run eval qsm-openspec`. Blocked by 8. **Waits.**
- [ ] 11. The skill `model`, `model-reviewer`, `model-simplifier`. Files:
  `plugins/qsm-models/skills/`, `agents/`. Proof: `bun run eval qsm-models`. Blocked by 8.
  **First build:** the skill `model` and `model-reviewer`. **Waits:** `model-simplifier`.
- [ ] 12. `pages`: `bpmn.html` and `c4.html` in `.qsm/models/`, `.qsm/` in `.gitignore` unless the
  lens change already put it there. Files: `plugins/qsm-models/lib/pages/`,
  `plugins/qsm-models/pages/` (the inlined templates), `.gitignore`. Proof: design Verify 7, then
  the scenarios of the requirement: a scripted browser opens both files from disk, drills a call
  activity and a C4 level, and records no request outside the file; a PNG of each page is looked at.
  Blocked by 5, 8. **First build.**
- [ ] 13. Local mode and links to other projects: the dependency on qsm-docs in `plugin.json`,
      `check` and `pages` reading a graph from the store, `qsm-docs list` for a call into another
      project. Files: `plugins/qsm-models/lib/`, `plugin.json`. Proof: the scenarios of local mode
      and of the missing store, against a real qsm-docs install. Blocked by qsm-docs line 4.
      **Waits.**
