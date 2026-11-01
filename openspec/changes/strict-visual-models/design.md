## Context

The structure is `models/qsm-models.c4`, the behaviour `models/qsm-models/model-gate.bpmn`,
`simplify.bpmn` and the process it calls, `try-rewrite.bpmn`. Every
number below was measured on 2026-11-01 (node 26.11, bun 1.4.3) with a prototype of each piece,
none of it in the tree.

## Decisions

1. **A plugin of its own, `qsm-models`, one binary.** Rejected: verbs in qsm-builder or
   qsm-openspec. It would be installed alone, carries npm packages neither needs, and serves the
   spec tool, the QA agent and the commit gate. The lens does not depend on it: it reads the
   committed pictures.
2. **Five verbs**: `lint`, `layout`, `render [--check]`, `paths [--all] [--specs]`, `check
   [--write]`. `layout` refuses a file that has geometry, because bpmn-auto-layout discards it and
   the owner's bpmn.io layout must survive. No `doctor`: a verb fails `missing` naming the
   package it lacks.
3. **Strict BPMN**: bpmnlint `recommended` with warnings raised to errors, plus `analytic-only`
   (BPMN 2.0.2 clause 2.2, tables 2.1 and 2.2), `split-flows-labelled`, `lanes-hold-every-node`,
   then lanes against C4 actor titles and no dead end. Analytic, not Descriptive, because QA tests
   failure, and only Analytic has error, timer and message events. Measured: the six models of
   this change and its neighbours pass the Method and Style rules of decision 14 with a prototype
   lint; the bpmnlint part is proved by Verify 2.
4. **Strict C4**: the tool owns the kinds (person, system, container, component) and the tags
   (`external`, `agent`, `shared`) and the properties (`colour`, `group`, `path`); level nesting,
   titled relations, unique titles, a code path on every internal container; the source declares no
   views, the tool generates one per level. Measured: the check finds a container in a container
   that `likec4 validate` accepts.
5. **The C4 source format is open** (open decision 1). Everything reads one normalised model, so
   only one adapter differs; the options are in the table below.

6. **Pictures are committed.** BPMN: bpmn-js 18.31.1's Viewer in jsdom under bun, text measured by
   an average glyph width (jsdom has no canvas); labels wrap, lanes draw. C4: one SVG per view, laid
   out by elkjs and drawn by the binary (decision 12), saved as `<name>.<level>.drawio.svg` with
   that view's draw.io diagram (draw.io's own `c4Type`, `c4Name`, `c4Technology`, `c4Description` on
   each shape) in the root element's `content` attribute, the owner's chosen form: GitHub shows the
   picture, draw.io opens the diagram.
7. **Where models live.** A change's `models/` mirrors its destination: `models/<plugin>/<f>.bpmn`
   becomes `plugins/<plugin>/models/<f>.bpmn`, a top-level `models/<f>.bpmn` the root `models/`.
   C4 elements merge by id: persons, systems and containers into the root marketplace model,
   components into the model of the plugin their container's path names.
8. **Paths become scenarios through the cover.** The cover's definition is in the spec, once.
   Measured (paths, cover): `flow.bpmn` 2, 1; `build-task.bpmn` 4, 3; `feature-status.bpmn` 11,
   11; `model-gate.bpmn` 9, 5; `simplify.bpmn` 10, 3; `try-rewrite.bpmn` 2, 2. A product feature's
   BPMN models what QA runs; a process model such as `flow.bpmn` models our own steps, and its
   cover paths are the scenarios of its spec, not sandbox runs. A BPMN split carries no data, so a
   memory such as "was any rewrite kept" is drawn as structure (a first try, then further tries),
   never as a split that asks about the past, which would put a path in the cover that no run takes.
9. **C4 against the code.** CLI calls are invisible to an import graph, so: container relations
   equal `plugin.json` dependencies both ways; component relations become
   `.dependency-cruiser.models.cjs`, one `allowed` rule each, which the repository's config
   includes.
10. **The lens** shows each plugin's `models/` pictures, each change on main with its proposal's
    first screen and pictures, and a BPMN in bpmn-js's navigated viewer (18.31.1, 190 KB) that
    qsm-builder pins and serves itself, since the lens requests nothing outside 127.0.0.1.
11. **The model is fixed, never the picture.** An agent places shapes badly (draw.io as source,
    measured) and the bpmn-auto-layout guide says the same: fix a diagram by changing order, lanes
    and levels, not coordinates. So the agent edits the source, an engine places every shape, and
    the layout measures of the spec judge the result against the picture it replaces.
12. **C4 is laid out by elkjs 0.12.1, not Graphviz.** ELK layered with hierarchy gives orthogonal
    edges, labels placed beside them, and boundaries and groups as nested boxes; `dot` gave
    splines whose labels overlapped in the crowded view (measured on the marketplace containers).
    elkjs is JavaScript, so the binary needs no program on PATH. Measured: it runs under bun; the
    process stays alive after the layout and needs an explicit exit.
13. **Where the sources disagree, the owner chose** (NotebookLM notebook "BPMN and C4 Diagrams in
    Real-World Use", 106 sources, and two web research passes): colour by actor, not by element
    kind, because C4 and BPMN leave colour to the team and the reader here follows actors across
    both notations; the GitHub Action as a lane, not a black-box pool, because it runs our own
    workflow file; at most 10 activities a level (Silver), not 7 plus or minus 2.
14. **Rules taken from the sources**: BPMN, Silver's Method and Style (verb-object activities,
    named end states, split answers, a loop back through a merge gateway, call activities for
    levels, matching split and join types); C4, Brown's notation and checklist (title, legend, type
    and technology on every element, one-way relations with a verb), the three tiers of practice,
    no actor drawn to everything, cross-cutting containers as a note. Brown gives no relation limit;
    the limit of 15 relations a view is ours, set from the 28-relation marketplace view that could
    not be read. Silver's "one action per activity" has no structural test beyond one flow in and
    one out, so the reviewer judges the names.
15. **Behaviour survives a rewrite by signature.** A cover path changes id when an activity is
    renamed or merged, so `paths --compare` compares signatures: the split answers in order and the
    end name. This is what QA observes, so a rewrite that keeps every signature keeps every
    scenario. It is also what the owner's test case needs: merging "Close the tasks the PR names"
    with "Tasks still open?" drops the answers, and both `one-flow-out` and the signatures refuse
    it.
16. **Review always, simplify on request.** `model-reviewer` runs on sonnet after every model a
    change adds (a review is never haiku); `model-simplifier` runs on opus, because one mind must
    hold the whole graph, and only when asked, because a pass costs several times a review.

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
- bpmn-auto-layout routes every loop back along one channel, so loops into one merge share a
  segment (measured: `build-task.svg`, where "Fix the findings" and "6 Merge the PR" share a column,
  and two returns climb one vertical; `model-gate.svg`, five returns into one merge). Reordering the
  input did not separate them. Accepted for now: the layout measure "segments two edges share"
  counts it, and open decision 3 holds the alternative, lanes and routing drawn by us.
