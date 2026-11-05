## Context

The structure is the qsm-models container of the marketplace's one C4 model,
`../feature-flow/models/marketplace.c4`; the behaviour `models/qsm-models/model-gate.bpmn`,
`simplify.bpmn` and the process it calls, `try-rewrite.bpmn`, which move into the one graph with the
rest (decision 7). Every number below was measured on 2026-11-01 (node 26.11, bun 1.4.3) with a
prototype of each piece, none of it in the tree, unless it says 2026-11-04.

## Decisions

1. **A plugin of its own, `qsm-models`, one binary.** Rejected: verbs in qsm-builder or
   qsm-openspec. It would be installed alone, carries npm packages neither needs, and serves the
   spec tool, the QA agent and the commit gate. From local mode on it depends on qsm-docs, for the
   graphs in local mode and for another project's graph; the first build has repo mode only and
   declares no dependency (decision 22). The lens does not depend on it.
2. **The verbs are the ones described in `qsm.json`, the one list.** The rules that bind them:
   `layout` refuses a file that has geometry, because bpmn-auto-layout discards it and the owner's
   bpmn.io layout must survive; `render --check` writes nothing. Later changes add their verbs
   to `qsm.json` and need no edit of any requirement here. No `doctor`: a verb fails `missing`
   naming the package it lacks.
3. **Strict BPMN, as bpmnlint rules, and pure business.** bpmnlint `recommended` with warnings
   raised to errors, plus `analytic-only` (BPMN 2.0.2 clause 2.2, tables 2.1 and 2.2),
   `split-flows-labelled`, `lanes-hold-every-node`, the Method and Style rules of decision 14 and no
   dead end, every one a bpmnlint rule so one linter reports them all. Analytic, not Descriptive,
   because QA tests failure, and only Analytic has error, timer and message events. A lane is a
   business role and names no C4 element: the rule that every lane is a C4 actor is dropped
   (2026-11-04), because the BPMN graph is the business and must stay usable without the
   architecture (research 2026-11-04: business models that hold are "tech agnostic"). Reopens when:
   a process can no longer be read without knowing which system does a step; the optional
   `qsm:c4` link of decision 17 is the answer first.
4. **Strict C4**: the tool owns the kinds (person, system, container, component) and the tags
   (`external`, `agent`, `shared`) and the properties (`colour`, `group`, `path`); level nesting,
   titled relations, unique titles, a code path on every internal container; the source declares no
   views, the tool generates one per level. Measured: the check finds a container in a container
   that `likec4 validate` accepts. What is drawn is the owner's rule: a plugin and its tool install,
   deploy and work on their own (AGENTS.md: the plugin is the install unit), so a plugin is a
   container, and the marketplace is the set of plugins its registry lists, of which a machine
   installs any subset. Level 3 opens a plugin: its tool (the binary and its verbs), hooks, skills
   and agents as `artifact` components, and what it builds on in the shared kit of root lib/, a
   container drawn without lines that 20 plugins import (measured in production code, each relative
   path resolved). A group is an area of the system, never a workflow step. Every relation names its
   technology (`exec, stdio`, `import`, `HTTPS, REST`). An agent is a Claude Code session in one
   role, a software system we do not build, tagged `agent`, so its colour stays in our views. The
   notebook's sources would draw a plugin as a packaging unit, not a C4 element, and agents as
   components of the agent runtime; the owner's rule wins over both.
5. **The C4 source is LikeC4 `.c4`** (settled 2026-11-04, epic qsm-vgw0). Options were LikeC4,
   draw.io as source, a YAML model. LikeC4 is a standard with its own check (`likec4 validate`),
   an agent writes it well, and the owner reads it as text. `bun add likec4@1.60.0` breaks
   (`yargs-parser`, measured), so the way it runs inside the binary is Verify 4. Reopens when:
   Verify 4 fails and npm on PATH is refused.
6. **Pictures are committed under `models/`.** BPMN: bpmn-js 18.31.1's Viewer in jsdom under bun,
   text measured by an average glyph width (jsdom has no canvas); labels wrap, lanes draw. C4: one
   SVG per view, laid out by elkjs and drawn by the binary (decision 12), saved as
   `<name>.<level>.drawio.svg` with that view's draw.io diagram (draw.io's own `c4Type`, `c4Name`,
   `c4Technology`, `c4Description` on each shape) in the root element's `content` attribute, the
   owner's chosen form: GitHub shows the picture, draw.io opens the diagram.
7. **One graph per kind per project, where the file decides** (2026-11-04). Options: a model per
   change merged at archive (the old decision), a model per plugin, one graph. Choice:
   `models/<project>.bpmn` and `models/<project>.c4`; committed means repo mode, absent means local
   mode in the qsm-docs store. Reason: a copy per change or per plugin drifts, and the research
   found models kept only where one model lives next to the code and a check backs it. A change
   works on the graph on its branch, so the archive moves nothing. Reopens when: two changes in
   flight conflict in the one XML file more than the agent can resolve.
8. **Paths become scenarios through the cover.** The cover's definition is in the spec, once.
   Measured (paths, cover): `flow.bpmn` 5, 4; `plan.bpmn` 4, 2; `split.bpmn` 2, 1; `build-task.bpmn`
   3, 2; `consume-task.bpmn` 1, 1; `land.bpmn` 2, 2; `feature-status.bpmn` 11, 11; `model-gate.bpmn`
   9, 5; `simplify.bpmn` 10, 3; `try-rewrite.bpmn` 2, 2; `edit-graph.bpmn` 4, 2; `pr-pictures.bpmn`
   3, 2; `delete.bpmn` 2, 2; `proposal.bpmn` 2, 2. A product feature's BPMN models what QA runs; a
   process model such as `flow.bpmn` models our own steps, and its cover paths are the scenarios of
   its spec, not sandbox runs. A BPMN split carries no data, so a memory such as "was any rewrite
   kept" is drawn as structure (a first try, then further tries), never as a split that asks about
   the past, which would put a path in the cover that no run takes.
9. **C4 against the code.** CLI calls are invisible to an import graph, so: container relations
   equal `plugin.json` dependencies both ways; component relations become
   `.dependency-cruiser.models.cjs`, one `allowed` rule each, which the repository's config
   includes.
10. **The graphs are read on their qsm-docs pages, not in the lens** (2026-11-04). The pages are the
    kinds of change `models-pages`; the lens shows no model and moves onto qsm-docs later. The old
    lens requirement and its BPMN viewer are dropped from this change.
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
    kind, because C4 and BPMN leave colour to the team and the reader follows actors across both
    notations, so a lane linked to a C4 actor takes its colour; the GitHub Action as a lane, not a
    black-box pool, because it runs our own workflow file; at most 10 activities a level (Silver),
    not 7 plus or minus 2.
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
    end name. This is what QA observes, not what an activity does, so a rewrite that keeps every
    signature is kept only after `model-reviewer` reads the changed activities. It is also what the
    owner's test case needs: merging "Close the tasks the PR names" with "Tasks still open?" drops
    the answers, and both `one-flow-out` and the signatures refuse it.
16. **Review always, simplify on request.** `model-reviewer` runs on sonnet after every model a
    change adds (a review is never haiku); `model-simplifier` runs on opus, because one mind must
    hold the whole graph, and only when asked, because a pass costs several times a review.
17. **Links are optional, written in the standard's own extension points, and checked where
    present** (2026-11-04). BPMN 2.0 allows attributes of another namespace on any element, so a
    link is `qsm:c4` or `qsm:decision`; LikeC4 has `metadata`, so a C4 link is `project` or
    `decision`. A decision link is repo-relative, `design:openspec/changes/<name>/design.md#<n>`,
    where `<n>` is a numbered item of that file; a link relative to anything else resolves
    differently in a worktree and in the archive. No link joins a task's Gherkin notes to a test
    (2026-11-05): they are text in the task's `documentation`. Reason: "if the diagram doesn't break
    the build when it's wrong, nobody updates it" (research 2026-11-04), so every link present must
    resolve, and none is required, because the graphs must stay usable alone. A decision lives in a
    spec's design or a commit, never a separate ADR file. Reopens when: bpmn.io drops the attributes
    on save (Verify 6).
18. **A C4 node may carry the commit it was verified at.** An agent reading a stale graph costs more
    than a person (research 2026-11-04). The count of commits since is shown on the page, never in
    a committed picture, because a count in a picture goes stale on every commit.
19. **Layout hints live in the graph.** BPMN carries its own geometry, so its layout is kept by
    never laying out a drawn process (decision 2). C4 has none, so an applied move becomes `layer`
    and `order` on the element, handed to ELK layered as its layer choice and position choice
    constraints. Reason: a PR picture nobody can read gets no review (research 2026-11-04). Reopens
    when: Verify 5 shows ELK ignores the constraints under hierarchy.
20. **The migration keeps signatures, not ids.** Fourteen files merged into one need unique
    element ids across processes, so colliding flow ids get their process id as prefix and some
    path ids change. Each file under `openspec/changes/` becomes one process of
    `models/marketplace.bpmn`, kept under its process id:
    - `feature-flow/models/flow.bpmn`: `feature_flow_process`, the main process;
    - `feature-flow/models/plan.bpmn`: `plan_process`; `split.bpmn`: `split_process`;
      `build-task.bpmn`: `build_task_process`; `consume-task.bpmn`: `consume_task_process`;
      `land.bpmn`: `land_process`;
    - `qsm-tasks-cli/models/qsm-tasks/feature-status.bpmn`: `feature_status_process`;
    - `strict-visual-models/models/qsm-models/model-gate.bpmn`: `model_gate_process`;
      `simplify.bpmn`: `simplify_process`; `try-rewrite.bpmn`: `try_rewrite_process`;
    - `qsm-docs/models/qsm-docs/delete.bpmn`: `docs_delete_process`; `proposal.bpmn`:
      `docs_proposal_process`;
    - `models-pages/models/qsm-models/edit-graph.bpmn`: `edit_graph_process`;
    - `models-pr-pictures/models/qsm-models/pr-pictures.bpmn`: `pr_pictures_process`.

    The C4 source `feature-flow/models/marketplace.c4` becomes `models/marketplace.c4`.
    `models-scenarios` is gone, with its `cover-path.bpmn`. A path's signature is what QA observes
    (decision 15), so `paths --compare` proves the behaviour kept, and every scenario that cites a
    changed id is rewritten in the same commit.
21. **The owner's style departs from the standard in one place.** Small arrows in the middle of long
    flows are not BPMN notation, which has one arrowhead at the target (notebook, Trisotech,
    Silver); the owner keeps them because the picture reads better, and they change no meaning.
    Filled steps in the actor's colour with white text are within the standard. Levels are separate
    diagrams linked through `calledElement`, as Method and Style prefers; one picture of every level
    with dashed connectors was dropped, because a dashed line in BPMN means a message flow.

22. **The first build is the visualization: static pages, no store** (2026-11-05). The owner wants
    to see the models before anything else: "absolute bare bones: generate, show proper models, with
    validation rules and proper modeling". Options: wait for qsm-docs and its pages (a store, a
    server and a page shell first), or `pages`, a verb that writes one self-contained HTML per graph
    kind. Choice: `pages`. `bpmn.html` is the bpmn-js Viewer pinned and inlined with the graph, the
    drill-down through call activities, and a details panel that shows a task's Gherkin notes as
    text; `c4.html` is the generated SVG views inlined, a click on an element opening its child
    view, the committed picture's zoom links rewritten to in-page links. Both go to
    `<repo>/.qsm/models/`, gitignored and regenerated on each run, the lens export's convention
    (`.qsm/lens.html`). The pages are later kinds of qsm-docs (`models-pages`), which replaces this
    verb's output and adds the store, edit mode and the Gherkin notes the owner writes. Reopens
    when: the page file passes 2 MB (measure in Verify 7) and loading is slow.

## Verify, each proved before the first task that depends on it

1. **`check` and the dependency-cruiser generator**: no such tool exists and none was built.
   Proof: generate the rules from `marketplace.c4`, add one import the model lacks, and see
   dependency-cruiser refuse it.
2. **bpmnlint inside a compiled binary**: the CLI resolves rules by `require` and fails compiled
   ("cannot resolve config", measured). Proof: `bun build --compile` a binary that hands its rules
   to bpmnlint's static resolver and lints `flow.bpmn` with the same findings as the CLI.
3. **draw.io opens a `.drawio.svg`** written this way: no draw.io here. Proof: open one in draw.io
   desktop and save it unchanged.
4. **`likec4 validate` from the binary**: under bun the package does not install (measured). Proof:
   a compiled binary that validates `marketplace.c4` with LikeC4's language services and gives the
   same verdict as the CLI; failing that, `likec4` installed by npm on PATH, named as a program the
   plugin needs, and `missing` without it.
5. **ELK keeps an order hint under hierarchy**: unverified. Proof: render the container view with
   `order` on qsm-docs and qsm-builder swapped, twice, and read the positions.
6. **A `qsm:` attribute survives**: unverified. First build: bpmn-moddle reads a `qsm:c4` attribute
   and writes it back (a fixture in line 7's proof). Waits for `models-pages`: the bpmn-js modeler
   keeps it on save; proof: open a graph with the attribute, move a shape, save, find the attribute.
7. **bpmn-js Viewer from one file**: unverified. Proof: `pages` on the one graph writes a single
   HTML whose script opens a file with several diagrams, `open` switches to a called process, and
   a scripted browser records no request but the file; the file size is written into the design.

## Open decisions

1. **Layout pin**: bpmn-auto-layout 2.0.0-alpha.2 exactly (recommended: 1.3.0 drops lane geometry,
   measured; the alpha is deterministic, measured), or lanes drawn by us on 1.3.0.

## Critiques

The critique passes are in the proposal, under `## Critiques`.
