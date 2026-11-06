## Build order

The change is built in stages, marked on each line. **First build** is what the owner saw first
(design decision 22), in `plugins/qsm-models`. **The split** (2026-11-06, lines 14 to 24) moves that
code into `plugins/qsm-bpmn` and `plugins/qsm-c4` and comes next, in the order written. **Waits** is
built after the split, in the plugin named. Each line can be shown working alone; the proof is the
run named after it.

The revision of 2026-11-06 unticked lines 3, 4 and 12, built but now in the wrong plugin, which
tick again when their move passes; rewrote lines 1, 5, 6 and 11 for the two plugins; removed
lines 2, 7, 9, 10 and 13, left without a checkbox, with the requirements the owner dropped; and
added lines 14 to 24. Line 8 stays ticked: the migrated graph is unchanged by the split. A line
marked **Moved** is code that exists, carried over with its tests; only a line marked **New** is
new work.

### First build, carried over

- [ ] 1. Verify 2, 4 and 6 of the design: bpmnlint in a compiled binary, `likec4 validate` from the
      binary, the C4 attribute kept by bpmn.io. Files: a scratch prototype, none in the tree.
      Proof: each verdict written into the design. **First build (done):** Verify 2 and 4, and
      Verify 7 ahead of line 12. **Waits (qsm-bpmn):** the modeler half of Verify 6, for
      `c4:element`, with models-pages.
- Line 2, **removed 2026-11-06**, replaced by line 14: the one plugin `plugins/qsm-models`. Its
      first build (README, `plugin.json`, `qsm.json`, the installer) is done and is deleted by
      line 24.
- [ ] 3. `lint` for BPMN: bpmnlint recommended and our rules as a bpmnlint plugin, Method and
      Style, the backtick rule. **Moved** by line 16 to `plugins/qsm-bpmn/lib/bpmn/`. Proof: the
      moved `runBin` test on the migrated graph and one fixture per rule, run against `qsm-bpmn`.
      **First build (built in qsm-models).**
- [ ] 4. `lint` for C4: `likec4 validate`, the vocabulary, the level rules, level 3 optional.
      **Moved** by line 15 to `plugins/qsm-c4/lib/c4/`. Proof: the moved test on `marketplace.c4`
      and the container-in-a-container fixture, run against `qsm-c4`. **First build (built in
      qsm-models).**
- [ ] 5. `layout`, `render` and `render --check`, the colour rule, the layout hints and the layout
      measure. Files: `plugins/qsm-bpmn/lib/bpmn/`, `plugins/qsm-c4/lib/c4/`,
      `plugins/qsm-c4/lib/c4/drawio.ts`. Proof: design Verify 5, then the same bytes on two
      renders, the pictures read as PNG, and a reordered lane refused by `render` with lane jumps
      named. **First build (done, moves by lines 15 and 16):** `layout` and `render` without hints
      or measure. **Waits:** the hints and Verify 5 (qsm-c4); the measure and `--accept`, one per
      plugin. Blocked by 20.
- [ ] 6. `paths` per process, `--process`, `--specs`, `--compare`. Files:
      `plugins/qsm-bpmn/lib/paths.ts`. Proof: the cover of every migrated process equals the
      measured one. **First build (done, moves by line 16):** `paths` without `--compare`.
      **Waits (qsm-bpmn):** `--compare`. Blocked by 16.
- Line 7, **removed 2026-11-06**: `check`. The stray-model check, the code check, the decision
  links, the verified commit and the links to other projects are dropped; its two surviving checks,
  a C4 id and a call to a missing process, become lint rules of qsm-bpmn in lines 18 and 19.
- [x] 8. The migration of the marketplace's models into `models/marketplace.bpmn` and
      `models/marketplace.c4`: the fourteen BPMN files named in design decision 20 and the C4
      source, the scenarios re-cited, the proposals' links rewritten, the old files deleted. Files:
      `models/`, `openspec/changes/*/models/`, the cited specs. Proof: the signatures of each old
      process, read with `paths --all` from the old file before it is deleted, all found in the one
      graph (`--compare` waits), `paths --specs openspec/changes` ok. **First build.**
- Line 9, **removed 2026-11-06**: the commit gate in qsm-langdev. The checks live in the generators
      (design decision 25, line 20).
- Line 10, **removed 2026-11-06**: the spec-propose and spec-archive change in qsm-openspec.
- [ ] 11. The skill `model`, `model-reviewer`, `model-simplifier`. Files:
      `plugins/qsm-bpmn/skills/model/`, `plugins/qsm-bpmn/agents/`, `plugins/qsm-c4/skills/model/`,
      `plugins/qsm-c4/agents/`. Proof: `bun run eval qsm-bpmn` and `bun run eval qsm-c4`. **First
      build (done in qsm-models, split by line 21):** the skill `model` and `model-reviewer`.
      **Waits (qsm-bpmn):** `model-simplifier`. Blocked by 21.
- [ ] 12. `pages`: `bpmn.html` and `c4.html` in `.qsm/models/`, `.qsm/` in `.gitignore`. **Moved**
      by lines 15 and 16 to `plugins/qsm-bpmn/lib/pages/`, `plugins/qsm-c4/lib/pages/` and each
      plugin's `pages/` template. Proof: design Verify 7, then the scenarios of each plugin's pages
      requirements: a scripted browser opens each file from disk, drills a call activity and a C4
      level, and records no request outside the file; a PNG of each page is looked at. **First
      build (built in qsm-models).**
- Line 13, **removed 2026-11-06**: local mode and links to other projects, with the dependency on
      qsm-docs.

### The split (2026-11-06)

- [ ] 14. **New.** The two plugin skeletons: `plugins/qsm-bpmn/` and `plugins/qsm-c4/`, each with
      README opening with `## Why it exists`, INSTALL.md, USAGE.md, `plugin.json` with no
      dependency, `qsm.json` with its verbs (qsm-bpmn: `doctor`, `lint`, `layout`, `render`,
      `paths`, `pages`; qsm-c4: `doctor`, `lint`, `render`, `elements`, `pages`),
      `scripts/install.ts` on `lib/install-base.ts`, `openspec/config.yaml`, `package.json` pinning
      only what its kind imports. Proof: `mise exec -- bun run validate`, both noun files
      generated.
- [ ] 15. **Moved.** The C4 code into qsm-c4: `lib/c4/`, `pages/c4.html.txt`, the C4 halves of
      `lib/graphs.ts`, `lib/lint.ts`, `lib/render.ts` and `lib/pages/pages.ts`, the C4 tests of
      `scripts/`; the palette of `lib/c4/style.ts` to root `lib/palette.ts`, which qsm-c4 imports.
      Files: `plugins/qsm-c4/**`, `lib/palette.ts`. Proof: the moved tests pass against the
      compiled `qsm-c4`, and `qsm-c4 render models/` writes the same bytes as `qsm-models render`
      wrote for every `.drawio.svg`. Blocked by 14.
- [ ] 16. **Moved.** The BPMN code into qsm-bpmn: `lib/bpmn/`, `lib/paths.ts`,
      `pages/bpmn.html.txt`, the BPMN halves of the split files, the BPMN tests of `scripts/`,
      importing the palette from root `lib/palette.ts`. Files: `plugins/qsm-bpmn/**`. Proof: the
      moved tests pass against the compiled `qsm-bpmn`, `qsm-bpmn render models/` writes the same
      bytes for every process SVG, and `qsm-bpmn paths --specs openspec/changes` gives the same
      findings as before. Blocked by 15.
- [ ] 17. **New.** The attribute migration: `qsm:c4` under `urn:qsm:models` becomes `c4:element`
      under `https://c4model.com` in `lib/bpmn/model.ts`, the fixtures, the skill and USAGE.md; a
      search first for a published convention for a C4 id in BPMN, whose result is written into
      design decision 24. `models/marketplace.bpmn` carries no `qsm:` attribute (measured
      2026-11-06), so nothing in it is rewritten. Files: `plugins/qsm-bpmn/lib/bpmn/model.ts`,
      `plugins/qsm-bpmn/scripts/`. Proof: a fixture with `c4:element` on a lane read by
      bpmn-moddle and written back unchanged (the moddle half of Verify 6), and
      `grep -r urn:qsm:models plugins/qsm-bpmn models` finds nothing. Blocked by 16.
- [ ] 18. **New.** The link through the CLI: `qsm-c4 elements [--json]`, and qsm-bpmn resolving
      every `c4:element` and every linked lane's colour by running it, never reading a `.c4` file,
      started only when the graph carries an id, `missing` without the binary. Files:
      `plugins/qsm-c4/lib/elements.ts`, `plugins/qsm-c4/qsm.json`,
      `plugins/qsm-bpmn/lib/bpmn/layout.ts`, `plugins/qsm-bpmn/lib/c4-ids.ts`. Proof: `runBin`
      tests of the scenarios "A process with no C4 ids" (qsm-c4 off PATH, every verb runs), "A C4
      id and no qsm-c4" and "A link that no longer resolves"; `validate-no-cross-plugin-import`
      clean. Blocked by 15, 17.
- [ ] 19. **New.** Deleting the dropped code: in the moved code, the decision links, the
      `<project>:` call and C4 `project` handling, the metadata keys `project`, `verified` and
      `decision`, the stray-model walk of `lib/conform.ts`, the verb `check`, and their tests; the
      call to a missing process becomes a lint rule of qsm-bpmn. Files: `plugins/qsm-bpmn/lib/`,
      `plugins/qsm-c4/lib/c4/`, both `qsm.json`, both USAGE.md. Proof: `bun run validate`, the
      remaining tests green, and a C4 source with `decision` in its metadata refused by
      `qsm-c4 lint` as an unknown property. Blocked by 18.
- [ ] 20. **New.** The checks in the generators: `layout` (without `no-bpmndi`), `render`, `pages`
      and `elements` run the full lint first and write nothing on a finding. Files: each plugin's
      `lib/render.ts`, `lib/pages/pages.ts`, `plugins/qsm-bpmn/lib/bpmn/layout.ts`,
      `plugins/qsm-c4/lib/elements.ts`. Proof: `runBin` tests of the two "A render of a graph lint
      refuses" scenarios, the pictures' bytes unchanged on disk. Blocked by 19.
- [ ] 21. **Moved.** The skill `model` and `model-reviewer` split by kind, one of each per plugin,
      the reviewer's step before an edit reaches the model file and `render --check` before a
      commit in each skill; the evals moved with them (`model-where-a-change-goes` to qsm-bpmn, a
      C4 case beside it). Files: `plugins/qsm-bpmn/skills/model/`, `plugins/qsm-bpmn/agents/`,
      `plugins/qsm-bpmn/evals/`, the same under `plugins/qsm-c4/`. Proof: `bun run eval qsm-bpmn`
      and `bun run eval qsm-c4`, each skill under 12 KB. Blocked by 20.
- [ ] 22. **New.** `models/marketplace.c4` draws qsm-models as two containers, qsm-bpmn and qsm-c4,
      each with its components and its relations (qsm-bpmn's tool to qsm-c4's tool, `exec, stdio`,
      reading element ids and colours), and loses the relations of what was removed (the commit
      gate, the conform component, the spec-propose relation). The proposals that link the
      qsm-models views link the new ones. Files: `models/marketplace.c4`, `models/*.drawio.svg`,
      `openspec/changes/{strict-visual-models,models-pages,models-pr-pictures}/proposal.md`.
      Proof: `qsm-c4 lint` and `qsm-c4 render` clean, the two component views read as PNG,
      `model-reviewer` of qsm-c4 returns no finding. Blocked by 21.
- [ ] 23. **New.** `model_gate_process` of `models/marketplace.bpmn` follows decision 25: no
      commit gate, no separate link check, the lint and the reviewer before the write. The
      scenarios of this change that cite its paths are re-cited in the same commit. Files:
      `models/marketplace.bpmn`, its SVGs, `openspec/changes/strict-visual-models/specs/`. Proof:
      `qsm-bpmn lint`, `qsm-bpmn render`, `qsm-bpmn paths --specs openspec/changes` with no new
      finding, `model-reviewer` of qsm-bpmn returns no finding. Blocked by 21.
- [ ] 24. **New.** The marketplace entry: `qsm-bpmn` and `qsm-c4` replace `qsm-models` in
      `.claude-plugin/marketplace.json`; `plugins/qsm-models/` is deleted; each installer removes,
      and names, the `qsm-models` binary and completion an older install left. Files:
      `.claude-plugin/marketplace.json`, `plugins/qsm-models/`, both `scripts/install.ts`. Proof:
      `bun run validate`, a clean install of both plugins, `command -v qsm-models` finds nothing,
      and a second install removes nothing. Blocked by 22, 23.
