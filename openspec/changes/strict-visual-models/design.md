## Context

The structure is `models/qsm-models.c4`, the behaviour `models/qsm-models/model-gate.bpmn`. Every
number below was measured on 2026-11-01 (node 26.11, bun 1.4.3) with a prototype of each piece,
none of it in the tree.

## Decisions

1. **A plugin of its own, `qsm-models`, one binary.** Rejected: verbs in qsm-builder or
   qsm-openspec. It would be installed alone, carries npm packages neither needs, and serves the
   spec tool, the QA agent and the commit gate. The lens does not depend on it: it reads the
   committed pictures.
2. **Five verbs**: `lint`, `layout`, `render [--check]`, `paths [--all] [--specs]`, `check
   [--write]`. `layout` refuses a file that has geometry, because bpmn-auto-layout discards it and
   the owner's bpmn.io layout must survive. No `doctor`: a verb fails `missing` naming `dot` or its
   package.
3. **Strict BPMN**: bpmnlint `recommended` with warnings raised to errors, plus `analytic-only`
   (BPMN 2.0.2 clause 2.2, tables 2.1 and 2.2), `split-flows-labelled`, `lanes-hold-every-node`,
   then lanes against C4 actor titles and no dead end. Analytic, not Descriptive, because QA tests
   failure, and only Analytic has error, timer and message events. Measured: the three models of
   this round lint clean.
4. **Strict C4**: the tool owns the kinds (person, system, container, component) and the tags
   (`external`, `agent`); level nesting, titled relations, unique titles, a code path on every
   internal container; the source declares no views, the tool generates one per level. Measured:
   the check finds a container in a container that `likec4 validate` accepts.
5. **The C4 source format is open** (open decision 1). Everything reads one normalised model, so
   only one adapter differs; the options are in the table below.

6. **Pictures are committed.** BPMN: bpmn-js 18.31.1's Viewer in jsdom under bun, text measured
   by an average glyph width (jsdom has no canvas); labels wrap, lanes draw. C4: one Graphviz SVG
   per view, saved as `<name>.<level>.drawio.svg` with that view's draw.io diagram (draw.io's own
   `c4Type`, `c4Name`, `c4Technology`, `c4Description` on each shape) in the root element's
   `content` attribute, the owner's chosen form: GitHub shows the picture, draw.io opens the
   diagram. Measured: the reader gets back 17, 15 and 9 elements of 17, 15 and 9.
7. **Where models live.** A change's `models/` mirrors its destination: `models/<plugin>/<f>.bpmn`
   becomes `plugins/<plugin>/models/<f>.bpmn`, a top-level `models/<f>.bpmn` the root `models/`.
   C4 elements merge by id: persons, systems and containers into the root marketplace model,
   components into the model of the plugin their container's path names.
8. **Paths become scenarios through the cover.** The cover's definition is in the spec, once.
   Measured: `flow.bpmn` 5 paths, cover 4; `feature-status.bpmn` 11, cover 11; `model-gate.bpmn` 8,
   cover 4. A product feature's BPMN models what QA runs; a process model such as `flow.bpmn`
   models our own steps, and its cover paths are the scenarios of its spec, not sandbox runs.
9. **C4 against the code.** CLI calls are invisible to an import graph, so: container relations
   equal `plugin.json` dependencies both ways; component relations become
   `.dependency-cruiser.models.cjs`, one `allowed` rule each, which the repository's config
   includes.
10. **The lens** shows each plugin's `models/` pictures, each change on main with its proposal's
    first screen and pictures, and a BPMN in bpmn-js's navigated viewer (18.31.1, 190 KB) that
    qsm-builder pins and serves itself, since the lens requests nothing outside 127.0.0.1.

| | A. LikeC4 `.c4` | B. draw.io as source | C. YAML of the model |
| --- | --- | --- | --- |
| Agent writes it | well | badly: every shape needs x, y | well |
| Owner edits it | text, VS Code preview | draw.io | text |
| Under the bun policy | `bun add likec4@1.60.0` breaks (`yargs-parser`), npm works | nothing to install | nothing to install |
| Adapter | `likec4 export json` | c4Type reader | `Bun.YAML` |

## Verify, each proved before the first task that depends on it

1. **`check` and the dependency-cruiser generator**: no such tool exists and none was built.
   Proof: generate the rules from `marketplace.c4`, add one import the model lacks, and see
   dependency-cruiser refuse it.
2. **bpmnlint inside a compiled binary**: the CLI resolves rules by `require` and fails compiled
   ("cannot resolve config", measured). Proof: `bun build --compile` a binary that hands its rules
   to bpmnlint's static resolver and lints `flow.bpmn` with the same findings as the CLI.
3. **draw.io opens a `.drawio.svg`** written this way: no draw.io here. Proof: open one in draw.io
   desktop and save it unchanged.

## Open decisions

1. **The C4 source format** (decision 5): C recommended (no dependency, bun only, the owner still
   gets draw.io), then A (if the LikeC4 preview matters more than an npm exception). B is not
   recommended as the source.
2. **The lens overview**: the C4 container view instead of the graph derived from `plugin.json`
   once `check` proves they agree (recommended), or both.
3. **Layout pin**: bpmn-auto-layout 2.0.0-alpha.2 exactly (recommended: 1.3.0 drops lane geometry,
   measured; the alpha is deterministic, measured), or lanes drawn by us on 1.3.0.

## Critiques

- A compiled renderer is 100 MB (measured). Accepted over Chrome, which bpmn-to-image needs.
- The render stubs use bpmn-js internals. The version is pinned; a break fails the render loud.
