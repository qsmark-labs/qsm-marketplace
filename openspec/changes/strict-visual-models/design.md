## Context

The structure is two containers of the marketplace's one C4 model, `models/marketplace.c4`:
qsm-bpmn and qsm-c4, which tasks line 22 draws in place of the one qsm-models container the first
build drew. The behaviour is `model_gate_process`, `simplify_process` and the process it calls,
`try_rewrite_process`, of the one graph `models/marketplace.bpmn` (decision 7). Every number below
was measured on 2026-11-01 (node 26.11, bun 1.4.3) with a prototype of each piece, none of it in
the tree, unless it says 2026-11-04 or later.

The revision of 2026-11-06 splits the built plugin `plugins/qsm-models` into `plugins/qsm-bpmn`
and `plugins/qsm-c4`, keeps one neutral link between them, moves every check into the verbs that
write, and drops the code check, the decision links, the verified commit, the stray-model check,
the links into other projects, the commit gate and the spec-propose change. The owner's words are
in the proposal, decision 9. Decisions it settled are 23 to 25; the choices it left open are marked
"decided 2026-11-06, the main agent, craft", each with the options it was chosen from.

## Decisions

1. **Removed 2026-11-06: one plugin, `qsm-models`, one binary.** The owner split it: "Chci 2
   separate tools". Decision 23 holds the split.
2. **Each binary's verbs are the ones described in its own `qsm.json`, the one list.** The rules
   that bind them: `layout` refuses a file that has geometry, because bpmn-auto-layout discards it
   and the owner's bpmn.io layout must survive; `render --check` writes nothing. Later changes add
   their verbs to `qsm.json` and need no edit of any requirement here. `doctor`, which the gate
   `validate-generated` asks of every binary, reports healthy and checks no program on PATH,
   because Verify 4 put LikeC4 inside the qsm-c4 binary (2026-11-05) and qsm-bpmn reaches qsm-c4
   only for a graph with C4 ids (decision 24).
3. **Strict BPMN, as bpmnlint rules, and pure business.** bpmnlint `recommended` with warnings
   raised to errors, plus `analytic-only` (BPMN 2.0.2 clause 2.2, tables 2.1 and 2.2),
   `split-flows-labelled`, `lanes-hold-every-node`, the Method and Style rules of decision 14 and no
   dead end, every one a bpmnlint rule so one linter reports them all. Analytic, not Descriptive,
   because QA tests failure, and only Analytic has error, timer and message events. A lane is a
   business role and names no C4 element: the rule that every lane is a C4 actor is dropped
   (2026-11-04), because the BPMN graph is the business and must stay usable without the
   architecture (research 2026-11-04: business models that hold are "tech agnostic"). Reopens when:
   a process can no longer be read without knowing which system does a step; the optional C4 id of
   decision 24 is the answer first.
4. **Strict C4**: qsm-c4 owns the kinds (person, system, container, component), the tags
   (`external`, `agent`, `shared`, `artifact`) and the properties (`colour`, `group`, `path`,
   `layer`, `order`); level nesting, titled relations, unique titles, a code path on every internal
   container; the source declares no views, the tool generates one per level. Measured: the check
   finds a container in a container that `likec4 validate` accepts. What is drawn is the owner's
   rule: a plugin and its tool install, deploy and work on their own (AGENTS.md: the plugin is the
   install unit), so a plugin is a container, and the marketplace is the set of plugins its
   registry lists, of which a machine installs any subset. Level 3 opens a plugin: its tool (the
   binary and its verbs), hooks, skills and agents as `artifact` components, and what it builds on
   in the shared kit of root lib/, a container drawn without lines that 20 plugins import (measured
   in production code, each relative path resolved). A group is an area of the system, never a
   workflow step. Every relation names its technology (`exec, stdio`, `import`, `HTTPS, REST`). An
   agent is a Claude Code session in one role, a software system we do not build, tagged `agent`,
   so its colour stays in our views. The notebook's sources would draw a plugin as a packaging
   unit, not a C4 element, and agents as components of the agent runtime; the owner's rule wins
   over both. The properties `project`, `verified` and `decision` are removed (2026-11-06).
5. **The C4 source is LikeC4 `.c4`** (settled 2026-11-04, epic qsm-vgw0). Options were LikeC4,
   draw.io as source, a YAML model. LikeC4 is a standard with its own check (`likec4 validate`),
   an agent writes it well, and the owner reads it as text. `bun add likec4@1.60.0` breaks
   (`yargs-parser`, measured), so the way it runs inside the binary is Verify 4. Reopens when:
   Verify 4 fails and npm on PATH is refused.
6. **Pictures are committed under `models/`.** BPMN, by qsm-bpmn: bpmn-js 18.31.1's Viewer in jsdom
   under bun, text measured by an average glyph width (jsdom has no canvas); labels wrap, lanes
   draw. C4, by qsm-c4: one SVG per view, laid out by elkjs and drawn by the binary (decision 12),
   saved as `<name>.<level>.drawio.svg` with that view's draw.io diagram (draw.io's own `c4Type`,
   `c4Name`, `c4Technology`, `c4Description` on each shape) in the root element's `content`
   attribute, the owner's chosen form: GitHub shows the picture, draw.io opens the diagram.
7. **One graph per kind per project, in the repository** (2026-11-04, revised 2026-11-06).
   Options: a model per change merged at archive (the old decision), a model per plugin, one graph.
   Choice: `models/<project>.bpmn` and `models/<project>.c4`, committed. Reason: a copy per change
   or per plugin drifts, and the research found models kept only where one model lives next to the
   code and a check backs it. A change works on the graph on its branch, so the archive moves
   nothing. Local mode, a graph kept only in the qsm-docs store when no file is committed, is
   removed (decided 2026-11-06, the main agent, craft; the other option was to keep it as later
   work): the MVP serves one project, the marketplace, whose graphs are committed ("Currently in
   MVP build currently for one project - qsm marketplace - only"); the history of a graph is the
   snapshots of its qsm-docs page (`models-pages`). The check that
   refused a model file outside `models/` is removed (2026-11-06). Reopens when: two changes in
   flight conflict in the one XML file more than the agent can resolve, or a second project needs
   a graph it does not commit.
8. **Paths become scenarios through the cover.** The cover's definition is in the spec, once.
   Measured (paths, cover): `flow.bpmn` 5, 4; `plan.bpmn` 4, 2; `split.bpmn` 2, 1; `build-task.bpmn`
   3, 2; `consume-task.bpmn` 1, 1; `land.bpmn` 2, 2; `feature-status.bpmn` 11, 11; `model-gate.bpmn`
   10, 6; `simplify.bpmn` 10, 3; `try-rewrite.bpmn` 3, 3; `edit-graph.bpmn` 4, 2; `pr-pictures.bpmn`
   3, 2; `delete.bpmn` 2, 2; `proposal.bpmn` 2, 2. A product feature's BPMN models what QA runs; a
   process model such as `flow.bpmn` models our own steps, and its cover paths are the scenarios of
   its spec, not sandbox runs. A BPMN split carries no data, so a memory such as "was any rewrite
   kept" is drawn as structure (a first try, then further tries), never as a split that asks about
   the past, which would put a path in the cover that no run takes. `paths` is qsm-bpmn's.
9. **Removed 2026-11-06: C4 against the code.** Container relations equal to `plugin.json`
   dependencies and generated dependency-cruiser rules are dropped by the owner, with Verify 1.
10. **The graphs are read on their qsm-docs pages, not in the lens** (2026-11-04). Each plugin's
    page is its kind on qsm-docs (`models-pages` for BPMN); the lens shows no model and moves onto
    qsm-docs later. The old lens requirement and its BPMN viewer are dropped from this change.
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
    notations, so a lane linked to a C4 actor takes its colour, read through qsm-c4 (decision 24);
    the GitHub Action as a lane, not a black-box pool, because it runs our own workflow file; at
    most 10 activities a level (Silver), not 7 plus or minus 2. The six colours are one table both
    plugins need, so it moves to root `lib/palette.ts` (decided 2026-11-06, the main agent, craft;
    the other option was a copy in each plugin; AGENTS.md: code two plugins need goes to `lib/`),
    and an unlinked lane takes from it without qsm-c4.
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
16. **Review always, simplify on request, each agent where its work lives** (placement and names
    decided 2026-11-06, the main agent, craft). Each plugin ships its own `model-reviewer`, on
    sonnet, which reads only its kind, because a plugin that works alone must review alone and the
    "in" gate of decision 25 needs a reviewer in each (a review is never haiku); the other option
    was one reviewer in one plugin. `model-simplifier`, on opus, ships in qsm-bpmn only: it walks
    processes and keeps a rewrite by `paths --compare`, which only BPMN has. It runs only when
    asked, because a pass costs several times a review. The skills are `bpmn-model` in qsm-bpmn and
    `c4-model` in qsm-c4, so a skill list names the notation without the prefix; the other option
    was `model` in both.
17. **Revised 2026-11-06: the only link is a C4 id on a BPMN element.** BPMN 2.0 allows attributes
    of another namespace on any element, so the link is an attribute (decision 24). The decision
    links (`qsm:decision`, C4 `decision`, `design:` and `commit:`), the `<project>:` call activity
    and C4 `project` are removed by the owner. No link joins a task's Gherkin notes to a test
    (2026-11-05): they are text in the task's `documentation`. A link present must resolve, and
    none is required, because each graph stays usable alone (research 2026-11-04: "if the diagram
    doesn't break the build when it's wrong, nobody updates it"). Reopens when: bpmn.io drops the
    attribute on save (Verify 6).
18. **Removed 2026-11-06: a C4 node carries the commit it was verified at.** Dropped by the owner
    with `verified`; the page shows no count.
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

    The C4 source `feature-flow/models/marketplace.c4` becomes `models/marketplace.c4`. A path's
    signature is what QA observes (decision 15), so `paths --compare` proves the behaviour kept, and
    every scenario that cites a changed id is rewritten in the same commit. Of an id two files
    share, the file later in this list keeps it and the earlier one prefixes its own with its
    process id (2026-11-05): prefixing the later one changed the ids of edit-graph's paths, so its
    greedy cover picked two other paths than the two its scenarios cite, and `paths --specs` failed.
    Done in the first build.
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
    kind. Choice: `pages`, one per plugin since the split. qsm-bpmn's `bpmn.html` is the bpmn-js
    Viewer pinned and inlined with the graph, the drill-down through call activities, and a details
    panel that shows a task's Gherkin notes as text; qsm-c4's `c4.html` is the generated SVG views
    inlined, a click on an element opening its child view, the committed picture's zoom links
    rewritten to in-page links. qsm-bpmn writes into `<repo>/.qsm/bpmn/` and qsm-c4 into
    `<repo>/.qsm/c4/`, both under the gitignored `.qsm/` (decided 2026-11-06, the main agent,
    craft: a directory per plugin, so neither run touches the other's output; the other option was
    one `.qsm/models/` for both). Each plugin's qsm-docs page later replaces its verb's output
    (`models-pages` for BPMN). Reopens when: a page file passes 2 MB (measure in Verify 7).
23. **Two plugins, `qsm-bpmn` and `qsm-c4`, each self-contained** (2026-11-06). The owner: "Chci 2
    separate tools, ktere mi zobrazi grafy modelu podle nasich rules ... The two tools are
    selfcontained, only with some options for connections between them". Options: one plugin with
    two binaries (refused by Iron Law 8, one plugin one binary), the one plugin as built, two
    plugins. Choice: two plugins, each with its binary, verbs, skill (`bpmn-model`, `c4-model`),
    `model-reviewer`, page and checks, each installed and run alone. The code is moved, not
    rewritten: `lib/bpmn/`, `lib/paths.ts` and `pages/bpmn.html.txt` go to qsm-bpmn; `lib/c4/` and
    `pages/c4.html.txt` to qsm-c4; `lib/graphs.ts`, `lib/lint.ts`, `lib/render.ts` and
    `lib/pages/pages.ts` split by kind. What both kinds do the same way went to root `lib/`,
    because the jscpd gate refused the two copies: `lib/model-graph.ts` (the notation, the one
    graph, `repoRoot`, findings, the render and page outcomes), `lib/pictures.ts` (settling the
    pictures), `lib/palette.ts`, two page helpers in `lib/html.ts`, and `removeRetiredBin` in
    `lib/install-base.ts`. Neither plugin imports the other (gate
    `validate-no-cross-plugin-import`). Reopens when: a third notation needs the same verbs.
24. **The link is a neutral C4 id, read through qsm-c4's CLI** (2026-11-06; the attribute, the door
    and the optional reach decided 2026-11-06, the main agent, craft). The owner: "using c4 ids or
    something in the bpmn, that is not qsm tool specific". Attribute options: `c4:element` under
    `https://c4model.com`, the home of the C4 notation the id belongs to; `urn:c4model:bpmn`, an
    unregistered URN namespace (RFC 8141 asks for a registered one); a URI under this repository,
    which is qsm-specific. Choice: `c4:element` under `https://c4model.com`, unless the search of
    tasks line 17 finds a published convention, which then wins. The search found none (2026-11-06:
    three SearXNG queries and one Tavily query for a C4 id, a C4 link or C4 traceability on a BPMN
    element returned BPMN's general extension mechanism, the bpmn.io forum and Open BPMN on
    extension attributes, and the C4 notation pages, none naming a namespace or an attribute for
    it), so `c4:element` under `https://c4model.com` stands. An XML namespace name is an identifier,
    never fetched (Namespaces in XML 1.0, section 2.2), so naming the notation's home says what the
    id is without naming our tool; the cost is a URI on a domain we do not own. qsm-bpmn reads it
    under whatever prefix the file binds to that URI, and a `c4` prefix bound to another URI is a
    lint finding, so a typo is loud. The door: a new verb `qsm-c4 elements --json`, which lists
    every element's id, kind, title, tags and actor colour, because AGENTS.md lets a plugin reach
    another only through its contract and no verb printed this. Options were that verb,
    `qsm-c4 lint --json` carrying the elements (a lint that returns data it does not judge), or a
    `get <id>` call per id (one process per lane). qsm-c4 is an optional reach and no `plugin.json`
    dependency of qsm-bpmn; against AGENTS.md law 2: qsm-c4 is reached only for a graph that carries
    C4 ids, and it fails `missing` there with no fallback. The other option, a declared dependency,
    would install qsm-c4 with every qsm-bpmn. The migration of `models/marketplace.bpmn` from
    `qsm:c4` rewrites nothing: measured 2026-11-06, the graph carries no `qsm:` attribute and binds
    no `urn:qsm:models`.
25. **The checks live in the generators** (2026-11-06; the fold of `check` and the way past a worse
    layout decided 2026-11-06, the main agent, craft). The owner: "Ten check co je v langdev ma byt
    v tech generatorech samotnych, kdyz to chcec vygenerovat in or out, or for the web, musi to
    projit vsema kontrolama, vcetne agents, teda web nemusi agents". Every verb that writes or
    converts a graph (`layout`, `render`, `pages`, `elements`, and what later changes add) runs the
    plugin's full lint first and writes nothing on a finding; `layout` leaves out `no-bpmndi`, the
    one finding it exists to fix. There is no `check` verb: it is folded into each plugin's lint. Of
    its checks only a C4 id and a call to a missing process survive, both lint rules of qsm-bpmn;
    its C4 half held only the links the owner removed, so qsm-c4's lint gains no rule. The other
    option was a `check` verb every generator also runs. "In", an edit written into the model file,
    the agent's own or a page's proposal applied, also needs `model-reviewer`'s pass. A binary
    cannot start an agent, so this half of the gate lives in each plugin's skill (`bpmn-model`,
    `c4-model`), which runs the reviewer and stops the write on a finding; a skipped review is
    caught by nothing but the skill, and the spec says so. "For the web", the PR picture
    (`models-pr-pictures`), is drawn read-only from the committed graph, which already passed both,
    so it needs the lint and no agent. The commit gate of qsm-langdev is removed with its
    requirement: a stale picture is found by `render --check`, which the skill runs before a commit.
    The layout measure compared a picture at the commit and let the commit message name a growth; it
    moves into `render`, which refuses a worse picture. Only `--accept <measure>` passes it, and the
    skill says that flag is the owner's to type, never the agent's, because accepting a worse
    picture is the owner's choice. The other options were no way past a worse measure, or a measure
    that only reports.
26. **Nothing a view paints touches, and ELK places it** (2026-11-06, the main agent, craft, from
    the owner's rule "Nikdy nikde nesmi byt nic co se dotyka"). The first build drew the boundary
    title after layout and moved each label with its own search, so a line ran through a title and
    labels sat on outlines and boxes. ELK now places every label (boundary and group titles as node
    labels, relation labels non-inline), with one spacing scale (step 8 px, gap 16 px) for its
    options and the check, and label widths from the font's own glyph advances. `render` and `pages`
    refuse a view where two painted things come closer than the gap, with no `--accept`, because a
    touch is never the owner's trade. A source the font cannot measure is a lint finding instead.
    The other options were a measure that only reports, or fixing views one by one in the source.
    Costs: views grew, because lines between layers keep the gap.

## Verify, each proved before the first task that depends on it

1. **Removed 2026-11-06** with decision 9: the dependency-cruiser generator is not built.
2. **bpmnlint inside a compiled binary**: the CLI resolves rules by `require` and fails compiled
   ("cannot resolve config", measured). Proof: `bun build --compile` a binary that hands its rules
   to bpmnlint's static resolver and lints `models/marketplace.bpmn` with the same findings as the
   CLI. **Verdict 2026-11-05: holds.** bpmnlint 12.0.0's `StaticResolver`, fed every recommended
   rule by a static import, compiled by `bun build --compile` (bun 1.4.4): `flow.bpmn` clean in
   both, and a fixture with a complex gateway, unnamed nodes and no DI gives the same 29 findings,
   rule and id, as the CLI, run from `/` with no `node_modules` beside it.
3. **draw.io opens a `.drawio.svg`** written this way: no draw.io here. Proof: open one in draw.io
   desktop and save it unchanged.
4. **`likec4 validate` from the binary**: under bun the package does not install (measured). Proof:
   a compiled binary that validates `marketplace.c4` with LikeC4's language services and gives the
   same verdict as the CLI; failing that, `likec4` installed by npm on PATH, named as a program the
   plugin needs, and `missing` without it.
   **Verdict 2026-11-05: holds in the binary, no program on PATH.** Under bun 1.4.3 and 1.4.4
   `likec4@1.60.0` installs; its CLI still breaks there (`cliui` not found), but its API does not
   need it: `LikeC4.fromWorkspace` and `getErrors()` compiled into a binary run from `/` give the
   npm CLI's verdict, valid on `marketplace.c4` with the vocabulary (79 elements, 104 relations),
   and on a relation to a missing element the same two errors on the same line. The binary is 94 MB
   with likec4 alone; after the split that is qsm-c4's, and qsm-bpmn's binary carries none of it.
5. **ELK keeps an order hint under hierarchy**: unverified. Proof: render the container view with
   `order` on qsm-docs and qsm-builder swapped, twice, and read the positions.
6. **The `c4:element` attribute survives**: unverified. First build: bpmn-moddle reads a foreign
   attribute and writes it back (line 17's fixture). Waits for `models-pages`: the bpmn-js modeler
   keeps it on save; proof: open a graph with the attribute, move a shape, save, find the attribute.
7. **bpmn-js Viewer from one file**: unverified. Proof: `pages` on the one graph writes a single
   HTML whose script opens a file with several diagrams, `open` switches to a called process, and
   a scripted browser records no request but the file; the file size is written into the design.
   **Verdict 2026-11-05: holds.** bpmn-js 18.31.1's navigated viewer inlined with three processes of
   one definitions (`flow`, `plan`, `split`): `open` on the diagram whose collaboration holds the
   called process draws planning after a click on "2 Plan the feature", and Chromium records one
   request, the file. The scratch page is 278 KB; `pages` on the one graph, fourteen processes,
   writes a `bpmn.html` of 448 KB and a `c4.html` of 168 KB with its twelve views, and a scripted
   Chromium drills both with one request each, the file.

## Open decisions

1. **Layout pin**: bpmn-auto-layout 2.0.0-alpha.2 exactly (recommended: 1.3.0 drops lane geometry,
   measured; the alpha is deterministic, measured), or lanes drawn by us on 1.3.0.

## Critiques

The critique passes are in the proposal, under `## Critiques`.
