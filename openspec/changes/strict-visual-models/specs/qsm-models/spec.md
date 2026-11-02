## Purpose

Strict visual models: BPMN for behaviour and C4 for structure, linted, rendered, walked into test
paths and checked against the code by one binary, so the owner, the agents and QA read one picture.

## ADDED Requirements

### Requirement: One binary, qsm-models, serves the model port

The plugin SHALL ship one binary `qsm-models`, named after the plugin, with the verbs `lint`,
`layout`, `render`, `paths` and `check` described in `qsm.json` and the noun `$.models`. It SHALL
read BPMN 2.0 XML files (`.bpmn`) and one C4 source format, and SHALL need no program outside the
binary: BPMN is laid out by bpmn-auto-layout and drawn by bpmn-js, C4 is laid out by elkjs and drawn
by the binary itself.

#### Scenario: Rendered on a clean machine

- **WHEN** `qsm-models render models/` runs on a machine with no Graphviz and no browser
- **THEN** it writes every picture, the same bytes as on any other machine

### Requirement: lint holds BPMN to the Analytic sub-class and to one actor per step

`lint` SHALL refuse a BPMN element outside the BPMN 2.0.2 Analytic sub-class, a flow out of an
exclusive or inclusive split without a label, a flow node in no lane or in two, a lane that names no
person or top-level system of the C4 model, and every rule of bpmnlint's recommended set, its
warnings as errors. Each finding SHALL name the file, the element id and the rule, and exit
`worse`.

#### Scenario: An unlabelled answer (path p-085ebe)

- **WHEN** a split gateway "Findings?" has two outgoing flows and one has no label, and once the
  model is clean its cover path has no scenario yet
- **THEN** `lint` exits `worse` naming the flow's id and the rule `split-flows-labelled`, the agent
  fixes the model before it renders, and writes the missing scenario before it commits

#### Scenario: A lane nobody is

- **WHEN** a lane is named "Bot" and the C4 model has no person or system titled "Bot"
- **THEN** `lint` exits `worse` naming the lane and the C4 file it read

#### Scenario: An element outside Analytic

- **WHEN** a process holds a complex gateway
- **THEN** `lint` exits `worse` naming it as outside the Analytic sub-class

### Requirement: lint holds C4 to its levels

`lint` SHALL accept only the kinds person, system, container and component, the tags `external`,
`agent`, `shared` and `artifact`, and the properties `colour`, `group` and `path`; and SHALL refuse
a person or a system that has a parent, a container outside a system, a component outside a
container, a relation without a title or a technology, two elements with one title, an internal
container without a code path, and a source that declares its own kinds or views.

#### Scenario: A container inside a container

- **WHEN** a C4 source puts container B inside container A, which LikeC4 itself accepts
- **THEN** `lint` exits `worse` saying a container sits in a system, not in a container

### Requirement: lint holds BPMN to Method and Style

`lint` SHALL refuse a process level with more than 10 activities, an activity with more than one
outgoing flow or more than one incoming flow (a loop goes back through a merge gateway, never into
the side of an activity), a merge gateway with a name, a level with several end events of which one
has no name, and a split right after a call activity whose answers are not the names of the called
process's end events.

#### Scenario: A named merge

- **WHEN** the merge before "Write the model source" is named "Model to write"
- **THEN** `lint` exits `worse` naming it and the rule `merge-unnamed`

### Requirement: An activity names one action

An activity's name SHALL be one verb and its object; a second decision is a gateway and a second
step an activity of its own. Lint checks the flows of this rule; whether a name holds one action is
the reviewer's judgment, because no structure shows it.

#### Scenario: A name that hides a second step

- **WHEN** an activity is named "Open the feature PR, change archived"
- **THEN** the reviewer returns it as two actions, and the model gets "Archive the change" and
  "Open the feature PR"

#### Scenario: Two actions merged into one activity

- **WHEN** "Close the tasks the PR names" and the split "Tasks still open?" are merged into one
  activity "Close the tasks, loop if any are open" with two outgoing flows
- **THEN** `lint` exits `worse` naming the activity and the rule `one-flow-out`

#### Scenario: A level grows past ten activities

- **WHEN** a process level holds 11 activities
- **THEN** `lint` exits `worse` naming the level and saying to move a run of steps into a call
  activity with its own diagram

### Requirement: The colour of an actor is one colour everywhere

Every top-level person and every system tagged `agent` SHALL carry one colour from the tool's
palette (navy, purple, orange, green, teal, red), no two the same. An external system SHALL be grey,
a container light blue, and a relation that starts inside the system grey and dashed. A BPMN lane
SHALL take the colour of the C4 actor it names. Every picture SHALL carry a legend of the colours
and shapes it uses. `lint` SHALL refuse an actor without a colour and two actors with one.

#### Scenario: The QA agent in two pictures

- **WHEN** the QA agent is green in the C4 model
- **THEN** its lane in every BPMN is green, its relations in every C4 view are green, and both
  legends say so

### Requirement: Generated C4 views are drawn in tiers

A generated view SHALL run its tiers left to right: the actors, then the system in scope with its
containers in the groups the source gives them, each group a tinted band, then external systems,
each beside the containers that use it and naming in a note those the view does not draw. Edges
SHALL be orthogonal, take the colour of the actor they start from, and carry their label beside
their own line, never over a box.

#### Scenario: The QA agent's relations

- **WHEN** the QA agent, tagged `agent` and green, files fix tasks with qsm-tasks
- **THEN** the QA agent sits in the first tier, qsm-tasks in its group inside the system, GitHub in
  the last tier beside that group with the note "used by qsm-tasks, qsm-forge", and the line from
  the QA agent to qsm-tasks is green with its label beside it

### Requirement: A BPMN picture reads at a glance

A BPMN picture SHALL draw lanes across with the flow left to right, each lane tinted and each step
filled in its actor's colour with white text, flows 3 px wide with a small arrow in the middle of
every segment longer than 70 px, and enough room that no flow touches a step or a label.

#### Scenario: The middle of a long flow

- **WHEN** the owner looks at the middle of the flow from "8.2 File a fix task per finding" back to
  the merge before "4-6 Build every open task" in `flow.svg`
- **THEN** a small arrow on that segment shows which way it runs

### Requirement: Diagrams link to each other

A call activity SHALL name the process it calls in `calledElement`. `render` SHALL make each call
activity a link to the picture of the process it calls, and SHALL put above the pool of a called
process one link back per step that calls it, each link relative to where the picture lives.

#### Scenario: From the flow into planning and back

- **WHEN** the owner clicks "2 Plan the feature" in `flow.svg`
- **THEN** `plan.svg` opens, and its line "Called by "2 Plan the feature" in A feature from request
  to main" leads back to `flow.svg`

### Requirement: C4 views zoom in and out

In a C4 picture, an element that has a view of its own SHALL carry a dashed outline and be a link to
that view, and every view below level 1 SHALL link back to the view that shows its boundary; the
two halves of a split view SHALL link to each other.

#### Scenario: From the context down to components and back

- **WHEN** the owner clicks qsm-marketplace in `marketplace.context`, then qsm-models in the
  container view
- **THEN** the component view of qsm-models opens, and its "Zoom out" link leads back to the
  container view, whose own link leads back to the context

### Requirement: A crowded container view is split by question

A container view with more than 15 relations SHALL be split into two views, who uses which
container and how the containers depend on each other. A container tagged `shared` SHALL draw no
relations and carry a note naming who uses it.

#### Scenario: The marketplace container view

- **WHEN** the marketplace container view would hold 22 relations among 4 actors and 6 containers
- **THEN** `render` writes `containers-uses` with the 13 relations the actors start and
  `containers-depends` with the 9 that start inside, each in tiers and actor colours, and each
  links to the other

### Requirement: lint measures the layout and refuses a worse one

`lint` SHALL measure each picture from its geometry: edge crossings, segments two edges share, total
and longest edge length, bends per edge, lane jumps per flow, labels that touch a line or a box, and
area per element, each divided by the element count. In the
commit gate it SHALL compare the staged picture with the one it replaces and exit `worse` naming
each measure that grew, unless the commit message names the measure and why.

#### Scenario: A reordered lane makes flows jump further

- **WHEN** a change moves the QA lane above the Owner lane and lane jumps per flow grow from 0.6 to
  1.1
- **THEN** `lint` exits `worse` naming lane jumps and both numbers

### Requirement: paths --compare proves a rewrite keeps the behaviour

A path's signature SHALL be its split answers in order and the name of its end event.
`paths --compare <old.bpmn> <new.bpmn>` SHALL exit `worse` naming each signature one model has and
the other lacks. Merging two activities in a row keeps every signature; removing a split or an
answer does not.

#### Scenario: A simplification drops an answer (path p-2fe723)

- **WHEN** the simplify agent merges a split into the activity before it
- **THEN** `paths --compare` exits `worse` naming the signatures that lost the split's answers, and
  the rewrite is dropped

#### Scenario: Two steps in a row merge (path p-b9aa8b)

- **WHEN** the simplify agent merges two activities of one lane that follow each other
- **THEN** `paths --compare` finds every signature in both models, `check` and the layout measures
  pass, and the rewrite is kept

### Requirement: The model skill takes any piece of work to checked models

The plugin SHALL ship a skill `model`: behaviour becomes BPMN and structure C4, and the scale
decides the views. A task changes a feature's process only when it changes behaviour; a feature
gets a process of at most 10 activities, a called process per call activity, and the container
view of what it touches; a plugin gets a process per verb that holds a state or a decision, and a
component view; the marketplace gets the main flow and its context and container views.

#### Scenario: A feature changes how a task is reviewed

- **WHEN** a feature adds a second review round to the task loop
- **THEN** the skill has the agent change `build-task.bpmn`, not `flow.bpmn`, run `lint` and
  `render`, and look at the picture before the model reaches the spec

### Requirement: A reviewer reads every model, a simplifier runs on request

The plugin SHALL ship an agent `model-reviewer` that reads each picture and its source against the
spec and the rules and returns findings, and an agent `model-simplifier`, run only on request, that
walks the graph, proposes merges, splits and reorders as a change to the source, and keeps only the
ones `paths --compare`, `check` and the layout measures accept.

#### Scenario: The reviewer finds a model unclear (path p-31cb80)

- **WHEN** a model passed lint, render and the gate, and the reviewer finds a split whose answers
  do not say what the spec says
- **THEN** the finding goes back to the agent, the model is written, linted and rendered again,
  and the reviewer reads it once more before the owner does

#### Scenario: Simplify on request (path p-298cd0)

- **WHEN** the owner asks to simplify `flow.bpmn`, the first rewrite drops a split's answer, the
  second merges two steps in a row, and a third try is refused
- **THEN** the simplifier drops the first naming `paths --compare`, keeps the second with the
  measures before and after, reports both, and the owner takes the simplified model

#### Scenario: The owner keeps the model as it was (path p-c7c303)

- **WHEN** the first rewrite is kept, no other is tried, and the owner reads the report and
  declines it
- **THEN** the model stays as it was and nothing is committed

#### Scenario: Nothing to simplify (path p-e8bca2)

- **WHEN** the first rewrite is refused and the simplifier has no other to try
- **THEN** it ends with nothing to simplify, names the rule that refused the rewrite, and the owner
  is not asked to read a report

### Requirement: layout never overwrites a drawn diagram

`layout <file.bpmn>` SHALL write the diagram geometry, pool and lanes included, into a BPMN file
that has none, deterministically, and SHALL exit `blocked` and change nothing when the file
already has geometry.

#### Scenario: The owner moved shapes in bpmn.io

- **WHEN** `layout` runs on a file the owner saved from bpmn.io
- **THEN** it exits `blocked` saying the file has a layout, and the file is unchanged

### Requirement: render commits a picture beside every source

`render` SHALL write `<name>.svg` beside each BPMN file, and for a C4 source one
`<name>.<level>.drawio.svg` per generated view: the picture, with the view's draw.io diagram, its
shapes carrying draw.io's C4 attributes, in the root element's `content` attribute. `render
--check` SHALL write nothing and exit `worse` naming each output that differs.

#### Scenario: A model changed and its SVG did not (path p-356c6b)

- **WHEN** the agent edits a BPMN file after it rendered the picture and commits both
- **THEN** `render --check` in the commit gate exits `worse` naming the stale SVG, the commit is
  refused, and the model goes back to be written, linted and rendered again

#### Scenario: The picture is unreadable (path p-2c87cd)

- **WHEN** the agent looks at a rendered SVG and a label is cut or two shapes overlap
- **THEN** it changes the model and renders again before the model reaches a spec

### Requirement: A path runs from a start to an end and has a stable id

A path SHALL run from a start to an end event taking each flow at most twice, so each loop goes
round at most once; its id SHALL be `p-` and the first six hex digits of the SHA-256 of its flow
ids joined by spaces.

#### Scenario: A re-layout keeps every id

- **WHEN** the owner moves shapes of `build-task.bpmn` in bpmn.io and saves it
- **THEN** `paths` prints the same ids as before, because no flow id changed

### Requirement: paths lists the cover of a process

The cover SHALL be built by taking, until every flow is taken, the path that adds the most flows
not yet taken, a tie going to the fewer flows, then the lowest id. `paths` SHALL print the cover,
`--all` every path; `--specs <dir>` SHALL exit `worse` per cover path no scenario cites and per
cited id that does not exist.

#### Scenario: Every cover path is cited

- **WHEN** `paths build-task.bpmn --specs specs/` runs on a change whose scenarios cite the three
  ids of its cover
- **THEN** it prints the three paths and exits `ok`, the same ids on every run

#### Scenario: A path with no end

- **WHEN** a task has no outgoing flow and is not an end event
- **THEN** `paths` exits `worse` naming it, because a path that does not end cannot be tested

### Requirement: check holds the C4 model to the code

`check` SHALL exit `worse` for an internal container whose path does not exist, a relation between
two internal containers that the source's `plugin.json` does not declare as a dependency, a
declared dependency with no relation, and a generated `.dependency-cruiser.models.cjs` that differs
from the model. `check --write` SHALL regenerate that file, one allowed rule per component relation.
The generator is proved before the first task that depends on it (design, Verify 1).

#### Scenario: The model and the manifest disagree

- **WHEN** the model says qsm-plan uses qsm-tasks and `plugins/qsm-plan/.claude-plugin/plugin.json`
  declares no dependency on it
- **THEN** `check` exits `worse` naming both and the file to change

### Requirement: Dependencies

The plugin SHALL declare no plug-in in `dependencies` and SHALL need no program on PATH.

#### Scenario: Installed alone

- **WHEN** only qsm-models is installed
- **THEN** every verb runs on a model directory without any other plugin
