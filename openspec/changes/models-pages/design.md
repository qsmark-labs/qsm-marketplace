## Context

The structure is the Kinds and Pages components of qsm-bpmn in `models/marketplace.c4`; the
behaviour is `edit_graph_process` of `models/marketplace.bpmn`. It stands on the store, the kind
manifest, the frame and the `/api/snapshots` API of change `qsm-docs`, and on the one graph and the
static pages of `strict-visual-models`.

## Decisions

1. **The page code lives in qsm-bpmn, served by qsm-docs.** A kind brings its own page, and
   qsm-docs knows nothing of BPMN (epic). The first build's `pages/bpmn.html.txt` becomes the kind's
   `index.html`, reading the snapshot from `/api/snapshots/<id>` instead of an inlined graph.
2. **The viewer, not the modeler.** The only edit is a step's text, and bpmn-js's Viewer reads and
   writes `documentation` through its moddle and returns the edited document with `saveXML`. The
   modeler's palette, drag and rules would be code for edits the owner does not make.
3. **A save is the whole edited XML.** The page posts `{"kind": "bpmn", "parent": <open id>,
   "content": <saveXML>}`. The agent hears of it through qsm-docs' hook, reads `qsm-docs diff`,
   copies the changed scenarios into `models/<project>.bpmn`, runs the gates, commits, and creates
   the applied snapshot with `--parent <proposal>`.
4. **Our own diff by element id.** It compares the two files' flow nodes by id and prints `added`,
   `removed`, `renamed` (the name changed) and `changed` (the Gherkin text changed, detail
   `gherkin`), in qsm-docs' change record shape. Reopens when: the page edits more than text.
5. **The converter is the parser `lint` already uses.** `convert bpmn` parses the file with the
   moddle of the first build, fails `failed` on anything that is not BPMN 2.0, and prints the
   processes with their steps, lanes and Gherkin, the JSON `gherkin` and a page can read.
6. **The printed form.** One `Feature` named after the process, a `Rule` per step with scenarios and
   the stored text under it; `--task` prints that step's rule alone. No tag, no result.

## Verify, each proved before the first task that depends on it

1. **Viewer `saveXML` keeps an edited `documentation`**: under bun with the bundled bpmn-js, set a
   step's documentation through the moddle, `saveXML`, and read the text back with `convert`.

## Critiques

The three critique passes are in the proposal, under `## Critiques`.
