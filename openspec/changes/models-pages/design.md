## Context

The structure is the Kinds and Pages components of qsm-models in
`../feature-flow/models/marketplace.c4`; the behaviour is `models/qsm-models/edit-graph.bpmn`. It
stands on the store, the kind manifest and the page shell of change `qsm-docs`, and on the one graph
and the layout hints of `strict-visual-models`.

## Decisions

1. **The page code lives in qsm-models, served by qsm-docs.** Options: pages in qsm-docs, pages in
   qsm-models installed as kind assets. Choice: kind assets. Reason: qsm-docs knows nothing of BPMN
   or C4 (epic), and a kind brings its own page. Reopens when: a second plugin needs the BPMN page.
2. **BPMN saves the whole XML, C4 saves a change list.** Options: whole files for both, change lists
   for both. Choice: the epic's split. Reason: BPMN carries its geometry in the XML and bpmn-js
   saves the whole document; a `.c4` source has no geometry, so a move is only expressible as a
   hint, and a list of operations is what the agent applies by hand to the text. Reopens when: the
   agent's apply of a `c4-change` keeps going wrong; then the page writes the `.c4` text itself.
3. **The BPMN diff is bpmn-js-differ 3.2.0, mapped to our words.** `_added` and `_removed` map to
   added and removed; `_changed` to renamed when only `name` changed, else changed; `_layoutChanged`
   to moved; a new text annotation to commented. Reason: a semantic diff, MIT, published 2026-02-09
   (research 2026-11-04). The C4 diff compares two LikeC4 exports by element id, ours to write,
   because no C4 differ was found.
4. **Lane rules in bpmn-js's rule system.** Options: undo after the drop, a rules module. Choice: a
   `RuleProvider` on `elements.move` that refuses a target lane other than the shape's own, so
   bpmn-js snaps the shape back itself. Reopens when: the owner wants to move a step to another role
   on purpose; then the page offers it as an explicit `lane` change.
5. **The C4 page draws with the same layout as the committed pictures.** Options: LikeC4's own
   React views, our ELK renderer in the browser. Choice: our renderer, bundled, so the page and the
   PR picture look the same and honour the same hints. Reason: a page that lays out differently
   from the picture breaks "the move stays where it was put". Reopens when: bundling ELK for the
   browser costs more than 1 MB (measure).
6. **Another project opens on its newest snapshot on main.** The epic's version rule; the research
   found Camunda's call activity binding `latest`, `deployment` or `versionTag`, and the epic chose
   latest on main.

7. **The Gherkin notes are the task's own `documentation` element.** Options: a text annotation
   linked to the task, a `qsm:` attribute, a file beside the graph. Choice: BPMN's `documentation`
   with `textFormat="text/x-gherkin"`, because it is the standard's place for text on an element and
   every BPMN tool keeps it. A comment stays a text annotation (it is a note to the agent, not model
   content). The printed form is one `Feature` named after the process, a `Rule` per task and the
   stored text under it; `--task` prints that task's rule alone. No tag, no result, no test link
   (owner decision, 2026-11-05). Reopens when: the owner wants one `.feature` file per task.
8. **The pages start from the first build's.** The static `bpmn.html` and `c4.html` of
   `strict-visual-models` (decision 22) become the kinds' page assets: the Viewer becomes the
   Modeler in edit mode, and the SVG views are the C4 page's drawing. Reason: one drawing of each
   graph, so the page and the committed picture never differ.

## Verify, each proved before the first task that depends on it

1. **bpmn-js-differ 3.2.0 under bun**: unverified that it runs outside a browser. Proof: diff two
   versions of one process under bun, read `_layoutChanged`, and read a `documentation` edit as
   `_changed`.
2. **ELK bundled for the browser**: proof: the C4 page lays out the container view in the browser
   with the bytes the binary writes.

## Critiques

The three critique passes are in the proposal, under `## Critiques`.
