## Purpose

Strict visual models: one BPMN graph of the business and one C4 graph of the architecture per
project, linted by their standard tools, rendered, walked into test paths, their links resolved and
checked against the code by one binary, so the owner, the agents and QA read one picture.

## ADDED Requirements

### Requirement: One binary, qsm-models, serves the model port

The plugin SHALL ship one binary `qsm-models`, named after the plugin, with the verbs described in
`qsm.json` and the noun `$.models`. It SHALL
read BPMN 2.0 XML (`.bpmn`) and LikeC4 (`.c4`) and nothing else. BPMN SHALL be laid out by
bpmn-auto-layout and drawn by bpmn-js, C4 laid out by elkjs and drawn by the binary itself.

#### Scenario: Rendered on a clean machine

- **WHEN** `qsm-models render models/` runs on a machine with no Graphviz and no browser
- **THEN** it writes every picture, the same bytes as on any other machine

### Requirement: One graph per kind per project

A project SHALL have one BPMN graph, `models/<project>.bpmn`, holding its main process and every
process a call activity calls, and one C4 graph, `models/<project>.c4`, each complete and usable
alone. `check` SHALL exit `worse` naming every `.bpmn` or `.c4` file elsewhere in the project, the
archive of OpenSpec changes left out.

#### Scenario: A change brings its own model file

- **WHEN** a change adds `openspec/changes/x/models/y.bpmn`
- **THEN** `check` exits `worse` naming the file and saying the change edits
  `models/marketplace.bpmn`

### Requirement: The file decides where a graph lives

A graph SHALL be in repo mode when its file under `models/` is committed: the file is the source and
a change edits it on its branch. With no such file the graph SHALL be in local mode: it lives only
in the qsm-docs store, as the newest snapshot of its kind on the branch, and an edit is `qsm-docs
get`, the edit, the gates on that file, then `qsm-docs create` with the old snapshot as parent.

#### Scenario: A project without a committed graph

- **WHEN** the agent changes the BPMN of a project that has no `models/<project>.bpmn`
- **THEN** it gets the newest `bpmn` snapshot of the branch, edits it, runs `lint` and `check` on
  it, and creates the new snapshot with the old one as parent, and no file is added to the
  repository

### Requirement: The marketplace's models migrate once into the one graph

The marketplace's fourteen BPMN files and its C4 source, named in design decision 20, SHALL move
once into `models/marketplace.bpmn` and `models/marketplace.c4`, and the old files SHALL be deleted,
with `c4-kinds.c4`, whose vocabulary the tool supplies. Every path signature SHALL be kept, every
scenario that cites a changed path id SHALL cite the new id, and every proposal SHALL link the
pictures under the root `models/`.

#### Scenario: Fourteen files become one graph

- **WHEN** the migration has run
- **THEN** every signature of the fourteen old processes is in the one graph (`paths --compare`
  finds none missing once it exists, and `paths --all` of each process shows it before), `paths
  --specs openspec/changes` exits `ok`, and `check` finds no model file outside `models/`

### Requirement: lint holds BPMN to the Analytic sub-class and to one lane per step

`lint` SHALL run bpmnlint with its recommended rules, warnings raised to errors, and with the rules
of this plugin as bpmnlint rules: an element outside the BPMN 2.0.2 Analytic sub-class, a flow out
of an exclusive or inclusive split without a label, and a flow node in no lane or in two. A lane
SHALL name a business role and need no C4 element. Each finding SHALL name the file, the element id
and the rule, and exit `worse`.

#### Scenario: An unlabelled answer (path p-750c84)

- **WHEN** a split gateway "Findings?" has two outgoing flows and one has no label, and once the
  graph is clean its cover path has no scenario yet
- **THEN** `lint` exits `worse` naming the flow's id and the rule `split-flows-labelled`, the agent
  fixes the graph before it renders, and writes the missing scenario before it commits

#### Scenario: A lane no C4 element names

- **WHEN** a lane is named "Accountant" and the C4 graph has no element titled "Accountant"
- **THEN** `lint` passes, because a lane is a business role

#### Scenario: An element outside Analytic

- **WHEN** a process holds a complex gateway
- **THEN** `lint` exits `worse` naming it as outside the Analytic sub-class

### Requirement: lint runs LikeC4's own check and holds C4 to the vocabulary

`lint` SHALL run `likec4 validate` on the source first, then accept only the kinds person, system,
container and component, the tags `external`, `agent`, `shared` and `artifact`, and the properties
`colour`, `group`, `path`, `project`, `verified`, `decision`, `layer` and `order`, and refuse a
source that declares its own kinds or views.

#### Scenario: A source LikeC4 refuses

- **WHEN** a relation names an element that does not exist
- **THEN** `lint` exits `worse` with the message of `likec4 validate`, naming the file and line

### Requirement: lint holds C4 to its levels

`lint` SHALL refuse a person or a system that has a parent, a container outside a system, a
component outside a container, a relation without a title or a technology, two elements with one
title, and an internal container without a code path. A container without components SHALL be
valid: level 3 is optional.

#### Scenario: A container inside a container

- **WHEN** a C4 source puts container B inside container A, which LikeC4 itself accepts
- **THEN** `lint` exits `worse` saying a container sits in a system, not in a container

#### Scenario: A plugin drawn without its parts

- **WHEN** the container qsm-cockpit has no components
- **THEN** `lint` passes and `render` writes no component view for it

### Requirement: lint holds BPMN to Method and Style

`lint` SHALL refuse a process level with more than 10 activities, an activity with more than one
outgoing flow or more than one incoming flow (a loop goes back through a merge gateway, never into
the side of an activity), a merge gateway with a name, a level with several end events of which one
has no name, and a split right after a call activity whose answers are not the names of the called
process's end events.

#### Scenario: A named merge

- **WHEN** the merge before "Edit the graph" is named "Graph to edit"
- **THEN** `lint` exits `worse` naming it and the rule `merge-unnamed`

### Requirement: An activity names one action

An activity's name SHALL be one verb and its object; a second decision is a gateway and a second
step an activity of its own. Lint checks the flows of this rule; whether a name holds one action is
the reviewer's judgment, because no structure shows it.

#### Scenario: A name that hides a second step

- **WHEN** an activity is named "Open the feature PR, change archived"
- **THEN** the reviewer returns it as two actions, and the graph gets "Archive the change" and
  "Open the feature PR"

#### Scenario: Two actions merged into one activity

- **WHEN** "Close the tasks the PR names" and the split "Tasks still open?" are merged into one
  activity "Close the tasks, loop if any are open" with two outgoing flows
- **THEN** `lint` exits `worse` naming the activity and the rule `one-flow-out`

#### Scenario: A level grows past ten activities

- **WHEN** a process level holds 11 activities
- **THEN** `lint` exits `worse` naming the level and saying to move a run of steps into a call
  activity with its own diagram

### Requirement: The BPMN graph knows nothing of code

The BPMN graph SHALL model the business: roles, steps, decisions and their outcomes. It SHALL name
no file, command, plugin or code element; the only way it reaches the architecture is an optional
link. The reviewer judges a name; `lint` refuses a name that holds a path or a command in backticks.

#### Scenario: A step named after a command

- **WHEN** an activity is named "Run `qsm-tasks close`"
- **THEN** `lint` exits `worse` naming it, and the graph gets "Close the task"

### Requirement: The colour of an actor is one colour everywhere

Every top-level person and every system tagged `agent` SHALL carry one colour from the tool's
palette (navy, purple, orange, green, teal, red), no two the same. An external system SHALL be grey,
a container light blue, and a relation that starts inside the system grey and dashed. Every picture
SHALL carry a legend of the colours and shapes it uses. `lint` SHALL refuse an actor without a
colour and two actors with one.

#### Scenario: Two agents in one colour

- **WHEN** the QA agent and the Review agent are both orange
- **THEN** `lint` exits `worse` naming both and the colour

### Requirement: A lane takes the colour of the actor it links to

A BPMN lane that links to a C4 element SHALL take that element's colour; a lane without a link
SHALL take the palette's colours not yet used, in lane order.

#### Scenario: The QA agent in two pictures

- **WHEN** the QA agent is green in the C4 graph and a lane links to it
- **THEN** that lane is green in the BPMN picture, the QA agent's relations are green in every C4
  view, and both legends say so

### Requirement: Generated C4 views are drawn in tiers

A generated view SHALL run its tiers left to right: the actors, then the system in scope with its
containers in the groups the source gives them, each group a tinted band, then external systems,
each beside the containers that use it and naming in a note those the view does not draw. Edges
SHALL be orthogonal, take the colour of the actor they start from, and carry their label beside
their own line, never over a box.

#### Scenario: The QA agent's relations

- **WHEN** the QA agent, tagged `agent` and green, files fix tasks with qsm-tasks
- **THEN** in the view of who uses what, the QA agent sits in the first tier, qsm-tasks in its
  group inside the system, and the line from the QA agent to qsm-tasks is green with its label and
  its technology beside it

### Requirement: A BPMN picture reads at a glance

A BPMN picture SHALL draw lanes across with the flow left to right, each lane tinted and each step
filled in its lane's colour with white text, flows 3 px wide with a small arrow in the middle of
every segment longer than 70 px, and enough room that no flow touches a step or a label.

#### Scenario: The middle of a long flow

- **WHEN** the owner looks at the middle of the flow from "8.2 File a fix task per finding" back to
  the merge before "4-6 Build every open task" in the picture of the feature flow
- **THEN** a small arrow on that segment shows which way it runs

### Requirement: Diagrams link to each other

A call activity SHALL name the process it calls in `calledElement`: a process of the same graph, or
`<project>:<process>` for a process of another project's graph. `render` SHALL make each call
activity a link to the picture of the process it calls, and SHALL put above the pool of a called
process one link back per step that calls it, each link relative to where the picture lives. A call
into another project SHALL be drawn with that project's name and link to no local picture.

#### Scenario: From the flow into planning and back

- **WHEN** the owner clicks "2 Plan the feature" in the picture of the feature flow
- **THEN** the picture of planning opens, and its line "Called by "2 Plan the feature" in A feature
  from request to main" leads back

### Requirement: C4 views zoom in and out

In a C4 picture, an element that has a view of its own SHALL carry a dashed outline and be a link to
that view, and every view below level 1 SHALL link back to the view that shows its boundary; the
two halves of a split view SHALL link to each other.

#### Scenario: From the context down to components and back

- **WHEN** the owner clicks qsm-marketplace in the context view, then qsm-models in the container
  view
- **THEN** the component view of qsm-models opens, and its "Zoom out" link leads back to the
  container view, whose own link leads back to the context

### Requirement: A crowded view is split by question

A view with more than 15 relations SHALL be split into two views, who uses which element and how the
elements depend on each other. A container tagged `shared` SHALL draw no relations and carry a note
naming who uses it.

#### Scenario: The marketplace container view

- **WHEN** the marketplace container view would hold 50 relations among 5 actors and 34 containers
- **THEN** `render` writes `containers-uses` with the 18 relations the actors start and only the
  containers they reach, and `containers-depends` with every container and the 32 relations that
  start inside, each in tiers and actor colours, and each links to the other

### Requirement: lint measures the layout and refuses a worse one

`lint` SHALL measure each picture from its geometry: edge crossings, segments two edges share, total
and longest edge length, bends per edge, lane jumps per flow, labels that touch a line or a box, and
area per element, each divided by the element count. In the commit gate it SHALL compare the staged
picture with the one it replaces and exit `worse` naming each measure that grew, unless the commit
message names the measure and why.

#### Scenario: A reordered lane makes flows jump further

- **WHEN** a change moves the QA lane above the Owner lane and lane jumps per flow grow from 0.6 to
  1.1
- **THEN** `lint` exits `worse` naming lane jumps and both numbers

### Requirement: An applied move survives the next render

A BPMN graph's layout SHALL be its diagram geometry: `render` draws it as it is and never lays out a
file that has geometry. A C4 element MAY carry the layout hints `layer` (its tier, counted from 0)
and `order` (its place within the tier); `render` SHALL hand them to the layout as constraints in
every view that draws the element, so a move the owner made and the agent applied stays where it
was put.

#### Scenario: qsm-docs moved left of qsm-builder

- **WHEN** the agent applies a move that puts qsm-docs before qsm-builder, as `order` hints on both
- **THEN** the next `render` draws qsm-docs left of qsm-builder in every container view, and a
  second render writes the same bytes

### Requirement: paths --compare checks what QA observes

A path's signature SHALL be its split answers in order and the name of its end event.
`paths --compare <old.bpmn> <new.bpmn>` SHALL exit `worse` naming each signature one graph has and
the other lacks. Merging two activities in a row keeps every signature; removing a split or an
answer does not. A signature holds no activity, so keeping every signature SHALL NOT be enough to
keep a rewrite: `model-reviewer` reads the changed activities first.

#### Scenario: A simplification drops an answer (path p-9edef7)

- **WHEN** the simplify agent merges a split into the activity before it
- **THEN** `paths --compare` exits `worse` naming the signatures that lost the split's answers, and
  the rewrite is dropped

#### Scenario: Two steps in a row merge (path p-f914aa)

- **WHEN** the simplify agent merges two activities of one lane that follow each other
- **THEN** `paths --compare` finds every signature in both graphs, `check` and the layout measures
  pass, and the rewrite is kept once `model-reviewer` has read the merged activity

#### Scenario: A merge keeps every signature but loses what an activity does (path p-855310)

- **WHEN** the simplify agent merges "Run the scenarios" into "File a fix task per finding", every
  signature is kept, and `model-reviewer` reads that the merged activity no longer says the
  scenarios run
- **THEN** the rewrite is dropped, and the report names the activity and the reviewer's reason

### Requirement: The model skill takes any piece of work to checked models

The plugin SHALL ship a skill `model`: behaviour goes into the project's BPMN graph and structure
into its C4 graph, and the scale decides where. A task changes a process only when it changes
behaviour; a feature gets a process of at most 10 activities and a called process per call
activity; a plugin gets a container with components when its parts matter; the project gets its
main process and its context and container views.

#### Scenario: A feature changes how a task is reviewed

- **WHEN** a feature adds a second review round to the task loop
- **THEN** the skill has the agent change the build-task process, not the feature flow, run `lint`
  and `render`, and look at the picture before the graph reaches the spec

#### Scenario: The owner asks for a change to a graph (path p-1d3d18)

- **WHEN** the owner reads a picture and it does not say what he wants
- **THEN** his request goes back to the agent, and the graph is edited, linted, rendered, its links
  checked and reviewed again before he reads it once more

### Requirement: A reviewer reads every graph change, a simplifier runs on request

The plugin SHALL ship an agent `model-reviewer` that reads each changed picture and its source
against the spec and the rules and returns findings, and an agent `model-simplifier`, run only on
request, that walks the graph, proposes merges, splits and reorders as a change to the source, and
keeps only the ones `paths --compare`, `check` and the layout measures accept and `model-reviewer`
passes after reading the changed activities.

#### Scenario: The reviewer finds a graph unclear (path p-9108fb)

- **WHEN** a change passed lint, render, the link check and the gate, and the reviewer finds a
  split whose answers do not say what the spec says
- **THEN** the finding goes back to the agent, the graph is edited, linted and rendered again, and
  the reviewer reads it once more before the owner does

#### Scenario: Simplify on request (path p-298cd0)

- **WHEN** the owner asks to simplify the feature flow, the first rewrite drops a split's answer,
  the second merges two steps in a row, and a third try is refused
- **THEN** the simplifier drops the first naming `paths --compare`, keeps the second with the
  measures before and after, reports both, and the owner takes the simplified graph

#### Scenario: The owner keeps the graph as it was (path p-c7c303)

- **WHEN** the first rewrite is kept, no other is tried, and the owner reads the report and
  declines it
- **THEN** the graph stays as it was and nothing is committed

#### Scenario: Nothing to simplify (path p-e8bca2)

- **WHEN** the first rewrite is refused and the simplifier has no other to try
- **THEN** it ends with nothing to simplify, names the rule that refused the rewrite, and the owner
  is not asked to read a report

### Requirement: layout never overwrites a drawn diagram

`layout <file.bpmn>` SHALL write the diagram geometry, pool and lanes included, for each process of
the file that has none, deterministically, and SHALL exit `blocked` and change nothing when the
process already has geometry.

#### Scenario: The owner moved shapes in bpmn.io

- **WHEN** `layout` runs on a file the owner saved from bpmn.io
- **THEN** it exits `blocked` saying the file has a layout, and the file is unchanged

### Requirement: render commits a picture beside the graph

`render` SHALL write `models/<project>.<process>.svg` per process of the BPMN graph, and one
`models/<project>.<view>.drawio.svg` per generated C4 view: the picture, with the view's draw.io
diagram, its shapes carrying draw.io's C4 attributes, in the root element's `content` attribute.
`render --check` SHALL write nothing and exit `worse` naming each output that differs.

#### Scenario: A graph changed and its SVG did not (path p-30235a)

- **WHEN** the agent edits the BPMN graph after it rendered the pictures and commits the graph
- **THEN** `render --check` in the commit gate exits `worse` naming the stale SVG, the commit is
  refused, and the graph goes back to be edited, linted and rendered again

#### Scenario: The picture is unreadable (path p-edf226)

- **WHEN** the agent looks at a rendered SVG and a label is cut or two shapes overlap
- **THEN** it changes the graph and renders again before the graph reaches a spec

### Requirement: A path runs from a start to an end and has a stable id

A path SHALL run from a start to an end event of one process taking each flow at most twice, so each
loop goes round at most once; its id SHALL be `p-` and the first six hex digits of the SHA-256 of
its flow ids joined by spaces.

#### Scenario: A re-layout keeps every id

- **WHEN** the owner moves shapes of the build-task process in bpmn.io and saves it
- **THEN** `paths` prints the same ids as before, because no flow id changed

### Requirement: paths lists the cover of each process

The cover of a process SHALL be built by taking, until every flow is taken, the path that adds the
most flows not yet taken, a tie going to the fewer flows, then the lowest id. `paths` SHALL print
the cover of every process of the graph, `--process <id>` of one, `--all` every path;
`--specs <dir>` SHALL exit `worse` per cover path no scenario cites and per cited id that does not
exist.

#### Scenario: Every cover path is cited

- **WHEN** `paths models/marketplace.bpmn --process build_task --specs openspec/` runs and the
  scenarios cite the three ids of its cover
- **THEN** it prints the three paths and exits `ok`, the same ids on every run

#### Scenario: A path with no end

- **WHEN** a task has no outgoing flow and is not an end event
- **THEN** `paths` exits `worse` naming it, because a path that does not end cannot be tested

### Requirement: check holds the C4 graph to the code

`check` SHALL exit `worse` for an internal container whose path does not exist, a relation between
two internal containers that the source's `plugin.json` does not declare as a dependency, a
declared dependency with no relation, and a generated `.dependency-cruiser.models.cjs` that differs
from the graph. `check --write` SHALL regenerate that file, one allowed rule per component relation.
The generator is proved before the first task that depends on it (design, Verify 1).

#### Scenario: The graph and the manifest disagree

- **WHEN** the graph says qsm-plan uses qsm-tasks and `plugins/qsm-plan/.claude-plugin/plugin.json`
  declares no dependency on it
- **THEN** `check` exits `worse` naming both and the file to change

### Requirement: A graph's links are optional and of three kinds

A graph SHALL carry no link but these, each optional: a BPMN element's `qsm:c4` to an element of the
C4 graph; a `<project>:` call activity or a C4 element's `project` to another project's graph; and
a node's `qsm:decision` or `decision` to a numbered decision of an OpenSpec design or to a commit.
A task's Gherkin notes are no link: they are text in the task's own `documentation`.

#### Scenario: A process with no links

- **WHEN** the BPMN graph carries no `qsm:c4`, no `qsm:decision` and no call into another project
- **THEN** `check` passes on the BPMN graph

### Requirement: A decision link is repo-relative and numbered

A design link SHALL be `design:<path>#<n>`, the path relative to the repository root, for example
`design:openspec/changes/strict-visual-models/design.md#3`, and `<n>` SHALL be a numbered item of
that file; a commit link SHALL be `commit:<sha>`.

#### Scenario: A decision link that resolves

- **WHEN** a node carries `qsm:decision="design:openspec/changes/strict-visual-models/design.md#3"`
  and that design's item 3 exists
- **THEN** `check` passes on that link

### Requirement: Every link resolves or the check fails

`check` SHALL exit `worse` naming each link present that does not resolve: the C4 element, the
decision (its file, or its numbered item) or the commit it names does not exist, or the other
project has no snapshot of that kind on main in the qsm-docs store. A link that is absent SHALL
never be a finding.

#### Scenario: A link that no longer resolves (path p-93184e)

- **WHEN** a change renames the C4 container `mp.tasks` and a BPMN task still carries
  `qsm:c4="mp.tasks"`
- **THEN** `check` exits `worse` naming the task, the link and the missing element, and the agent
  edits the graph again before it commits

#### Scenario: A design link to a number the file lacks

- **WHEN** a node carries `qsm:decision="design:openspec/changes/strict-visual-models/design.md#99"`
  and that design has no item 99
- **THEN** `check` exits `worse` naming the node, the file and the number

### Requirement: A C4 node may say when it was last verified

A C4 element MAY carry `verified` with the commit at which it was last checked against the code.
`check` SHALL exit `worse` when that commit is not in the history of the checked-out branch. The
page of the C4 graph shows how many commits ago it was verified (change `models-pages`).

#### Scenario: A verified commit that was rebased away

- **WHEN** qsm-tasks carries `verified 'a1b2c3d'` and that commit is not in the branch's history
- **THEN** `check` exits `worse` naming qsm-tasks and the commit

### Requirement: pages writes one self-contained HTML per graph kind

`pages [--out <dir>]` SHALL run the checks of `lint` and, when they pass, write `bpmn.html` for the
project's BPMN graph and `c4.html` for its C4 graph into `<repo>/.qsm/models/`, which the
repository's `.gitignore` names, replacing what an earlier run wrote. A page SHALL hold the bpmn-js
Viewer at its pinned version, its styles, the graph and the C4 views inside the file, and SHALL
request nothing outside it. A graph `lint` refuses SHALL write no page and exit `worse`.

#### Scenario: Both pages from a clean checkout

- **WHEN** `qsm-models pages` runs in a checkout with `models/marketplace.bpmn` and
  `models/marketplace.c4`, then a scripted browser opens each file from disk and records its
  requests
- **THEN** `.qsm/models/bpmn.html` and `.qsm/models/c4.html` exist, both open, and the browser made
  no request except for the file itself

#### Scenario: A project with one graph

- **WHEN** `pages` runs where only `models/shop.bpmn` exists
- **THEN** it writes `bpmn.html` only and says there is no C4 graph, and where neither file exists
  it exits `failed` naming `models/`

#### Scenario: A graph that fails lint

- **WHEN** `pages` runs on a graph with an unlabelled split answer
- **THEN** it exits `worse` naming the flow and the rule, and the files of the earlier run are
  unchanged

### Requirement: The static pages walk the graph

`bpmn.html` SHALL open on the main process, SHALL open the process a clicked call activity calls
with a breadcrumb back, and SHALL show a clicked task's lane, name and its `documentation` of format
`text/x-gherkin` as read-only text. `c4.html` SHALL open on the context view and SHALL open the
child view of a clicked element that has one, with a link back.

#### Scenario: Into a called process and back

- **WHEN** the owner clicks the call activity "2 Plan the feature" on the page of the feature flow
- **THEN** the process of planning opens, the breadcrumb names both processes, and clicking the
  first leads back

#### Scenario: From the context down to the components

- **WHEN** the owner clicks qsm-marketplace on `c4.html`, then qsm-models, then qsm-cockpit
- **THEN** the container view opens, then the components of qsm-models, and qsm-cockpit, which has
  no components, opens nothing

#### Scenario: A task holding Gherkin notes

- **WHEN** a task's `documentation` has `textFormat="text/x-gherkin"` and the owner clicks the task
  on `bpmn.html`
- **THEN** its details show the lane, the name and the scenarios as text, and cannot be edited

### Requirement: Dependencies

The plugin SHALL declare these plug-ins in `dependencies`, and SHALL need no program on PATH but
those the design's Verify 4 names:

- `qsm-docs`: a graph in local mode lives in its store, and the link check finds another project's
  graph there. The first build (design decision 22) declares none, because it has repo mode only.

#### Scenario: The store is not installed

- **WHEN** qsm-docs is not installed and `check` meets a call into another project
- **THEN** `check` exits `missing` naming qsm-docs
