## Context

The structure is `models/qsm-models.c4` and its three SVGs, the behaviour `models/model-gate.bpmn`.
Every number below was measured on 2026-11-01 on this machine (node 26.11, bun 1.4.3) with a
prototype of each piece; nothing of it is in the tree. The research behind the choices is the
bpmn.io, BPMN 2.0.2 (clause 2.2), draw.io, LikeC4 and dependency-cruiser documentation.

## Decisions

### 1. A new plugin, `qsm-models`, with one binary

Options: a verb set in qsm-builder (the lens), in qsm-openspec (the spec tool), or a plugin of its
own. Choice: its own plugin. Reason: it would be installed alone (any project can keep strict
models), it carries npm dependencies neither neighbour needs, and three plugins use it: the spec
tool's skills, the QA agent and the commit gate. The lens does not depend on it: it reads the
committed SVGs as files. Reopens when: a second plugin needs to import its code (then root `lib/`).

### 2. Five verbs, and nothing a neighbour does

| Verb | Does | Fails |
| --- | --- | --- |
| `lint <path>...` | BPMN and C4 strictness, lanes against C4 actors | `worse`, one line per finding |
| `layout <file.bpmn>` | writes the diagram geometry of a file that has none | `blocked` when it has some |
| `render <path>... [--check]` | an SVG beside each BPMN; per C4 model one SVG per level and a `.drawio` | `worse` with `--check` when stale |
| `paths <file.bpmn> [--all] [--specs <dir>]` | the cover of every flow, or all paths; with `--specs`, every path cited | `worse` per uncited path or unknown id |
| `check [--write]` | the C4 model against the code: paths, dependencies, import rules | `worse` per mismatch |

`layout` refuses a file with geometry because bpmn-auto-layout discards existing coordinates: a
layout the owner made in bpmn.io is never overwritten. No `doctor`: each verb fails `missing`
naming `dot` or its npm package, the way every qsm binary does.

### 3. Strictness rules

BPMN: bpmnlint's `recommended` with every warning raised to an error, plus three rules of a
plugin the binary carries: `analytic-only` (the BPMN 2.0.2 Analytic sub-class, tables 2.1 and
2.2; diagram geometry is skipped), `split-flows-labelled` (each flow out of an exclusive or
inclusive split names its answer), `lanes-hold-every-node`. Then, outside bpmnlint: every lane is
the title of a person or a top-level system of the C4 model, and every path reaches an end event.
Why Analytic and not Descriptive: QA tests what happens on failure, and only Analytic has error,
timer and message events and default flows. Measured: the dogfood `flow.bpmn` (30 nodes, 36
flows, five lanes) lints clean; the C4 checks find four errors in a model LikeC4 validates.

C4: the four kinds and two tags (`external`, `agent`) are the tool's, never the author's; a person
and a system sit at the top, a container in a system, a component in a container; every relation
has a title; titles are unique, because a lane names an actor by title; an internal container
names its code path. A source declares no views: the tool generates context, containers of each
internal system, and components of each container, so no view can mix levels.

### 4. The C4 source format: open, the owner decides

Everything else reads one normalised model (elements with kind, parent, title, summary,
technology, tags, path; relations with a title), so only one adapter differs per option.

| | A. LikeC4 `.c4` | B. draw.io `.drawio` as source | C. YAML of the normalised model |
| --- | --- | --- | --- |
| Agent writes it | well: text, no geometry | badly: every shape needs x, y (unmeasured) | well: text, no geometry |
| Owner edits it | text, or LikeC4's VS Code preview | draw.io, visually | text |
| Owner opens it in draw.io | yes, our export | yes | yes, our export |
| Validation | `likec4 validate` plus ours (it accepts a container in a container, measured) | ours only | ours only |
| One model, many views | yes | no: each page is its own truth | yes |
| Install under the bun policy | broken: `bun add likec4@1.60.0` leaves `yargs-parser` unresolved, measured; npm works | nothing to install | nothing to install |
| Adapter | `likec4 export json` (measured) | c4Type parser, 50 lines (measured on our export) | `Bun.YAML` parse |

Measured for all three: our draw.io writer puts draw.io's own C4 attributes (`c4Type`,
`c4Name`, `c4Technology`, `c4Description`) on each shape, and the c4Type reader reads the file back
to the same 16 elements, kinds, parents and paths. LikeC4's own draw.io export carries no
`c4Type`, so B cannot read it. Recommendation: C, then A. C keeps the tool bun-only and the source
small, the owner still opens every view in draw.io with its C4 shapes, and an edit he makes there
can be read back as a model diff. Choose A if the LikeC4 editor's live preview matters more than
the npm exception. B as the source is not recommended: agents place geometry badly and views
drift apart; its reader stays the way an owner's draw.io edit comes back. The dogfood models of
this round are LikeC4 (A), as asked; under C they convert one to one.

### 5. Rendering: committed SVG, two engines

BPMN: bpmn-js 18.31.1's Viewer in jsdom under bun, with text measured by an average glyph width
because jsdom has no canvas. Measured: labels wrap inside their shapes, lanes and the pool are
drawn, 89 KB for `flow.bpmn`; compiled with `bun build --compile` it runs (a 100 MB binary).
bpmn-to-image was rejected: it needs Chrome. C4: the tool writes Graphviz DOT per generated view
and runs `dot -Tsvg`. GitHub shows an SVG in a pull request with its image diff. Reopens when:
bpmn-js changes what it measures (the stubs are its private seams).

### 6. Where models live

A feature change carries `models/` (the schema's artifact). The current truth lives with its
owner: `plugins/<name>/models/` for a plugin's components and processes, root `models/` for the
marketplace's context and containers. Archive moves a change's BPMN by file name and merges its
C4 elements by id into the owner's model, the way it merges delta specs.

### 7. Paths are the QA agent's scenarios

`paths` walks every start-to-end path, a loop going round at most once, and prints the greedy
cover: the fewest paths that take every flow. A path's id is a hash of the flow ids it takes, so a
re-layout keeps it and a changed path gets a new one, which `--specs` then reports as uncited.
Measured: `flow.bpmn` has 16 paths and a cover of 7; `feature-status.bpmn` 12 and 9.

### 8. C4 against the code

Containers talk through CLIs, which no import graph sees, so the check is twofold. Container
level: every relation between two internal containers matches the source's `plugin.json`
`dependencies`, and every declared dependency has a relation. Component level: the tool writes
`.dependency-cruiser.models.cjs` with one `allowed` rule per component relation (from and to by
the components' paths); the repository's dependency-cruiser config includes it, so the existing
gate refuses an import the model does not have. `check --write` regenerates it, `check` fails when
it is stale. Unproven end to end: no tool exists that does this, and the generator was not built.

### 9. The lens shows the models

The lens reads `models/*.svg` of each plugin into a Models section of its page, shows each change in
flight with the first screen of its proposal and its SVGs, and opens a BPMN in bpmn-js's navigated
viewer (18.31.1, 190 KB) that qsm-builder pins and serves itself, because the lens requests nothing
outside 127.0.0.1; the export inlines it. It does not call `qsm-models`. Whether the overview keeps
its own dependency graph beside the C4 container view is open decision 2.

## Open decisions

1. **The C4 source format** (decision 4): C (recommended), A or B.
2. **The lens overview**: show the C4 container view instead of the graph the lens derives from
   `plugin.json` (recommended, once `check` proves they agree), or both.
3. **The layout engine pin**: lanes need bpmn-auto-layout 2.0.0-alpha.2 (1.3.0 drops the lane and
   pool geometry, measured). Pin the alpha exactly (recommended, the same input gives the same
   bytes, measured) or draw lanes ourselves on 1.3.0.

## Critiques

Devil's advocate:

- A 100 MB binary for a renderer is heavy. Waived: it is installed once, and the alternative is
  Chrome; a smaller build is a later measurement.
- The render stubs depend on bpmn-js internals. Fixed in part: the version is pinned and the stub
  is one function; an upgrade that breaks it fails the render loud.
- A greedy cover is not the minimum. Waived: it covers every flow, which is the claim; the minimum
  is NP-hard and buys nothing a reviewer sees.
- bpmnlint resolves rules by `require` at run time, which a compiled binary cannot (measured:
  "cannot resolve config"). Fixed in the design, unmeasured: the binary hands its rules to
  bpmnlint's static resolver.

Future archaeologist:

- Why does the tool own the C4 kinds? Decision 3: a level rule over author-chosen kinds is no rule.
- Why are views generated? Decision 3: an authored view can mix levels.
- Why hashes for path ids? Decision 7.

Scope sniper:

- `check` at container level and the dependency-cruiser generator are the least proven part.
  Kept: without them the model drifts from the code, which is the failure the owner named.
- The lens features view could wait. Kept: it is the owner's "visibility of what is planned".
