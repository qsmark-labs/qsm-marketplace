## ADDED Requirements

### Requirement: qsm-models installs its kinds into qsm-docs

The installer SHALL remove the kinds `bpmn`, `c4` and `c4-change` an older install left, then
install them with `qsm-docs kind add`, each manifest naming its media type, its extension, its page
assets and the commands `qsm-models convert <kind> {file}` and `qsm-models diff <kind> {a} {b}`.

#### Scenario: Installed twice

- **WHEN** qsm-models is installed, then installed again
- **THEN** `qsm-docs kind list` shows `bpmn`, `c4` and `c4-change` once each, and the second run
  names the three kinds it removed

### Requirement: convert turns a model snapshot into JSON

`convert <kind> <file>` SHALL print the JSON a page reads, or fail `failed` naming what is wrong:
for `bpmn`, every process with its lanes, nodes, flows, links and geometry, the file parsed as BPMN
2.0 XML; for `c4`, every element and relation of the LikeC4 export with its properties, the file
refused when `likec4 validate` refuses it; for `c4-change`, the parent and each change.

#### Scenario: A BPMN file that is not BPMN

- **WHEN** `qsm-docs create bpmn notes.xml` runs on an XML file that is not BPMN 2.0
- **THEN** it exits `failed` with the converter's message, and nothing is stored

### Requirement: A c4-change names its parent and its changes

A `c4-change` snapshot SHALL be JSON with `parent`, the id of a `c4` snapshot, and `changes`, a list
whose items are `move` (an element and its new `layer` and `order`), `rename` (an element and its
new title), `comment` (an element and a text), `add` (a container or component, its parent and
title) and `remove` (an element). The converter SHALL refuse a parent that is not a `c4` snapshot
and an item that names an element the parent lacks.

#### Scenario: A rename of an element that is not there

- **WHEN** a `c4-change` renames `mp.nope` in a parent that has no such element
- **THEN** `qsm-docs create` exits `failed` naming `mp.nope` and the parent's id

### Requirement: The BPMN page walks the whole graph

`/bpmn/<id>` SHALL show the graph in the bpmn-js modeler, open on the main process. A call activity
SHALL open the process it calls; a call into another project SHALL open that project's newest `bpmn`
snapshot on `main`, or say that the project has none. A breadcrumb SHALL lead back up each level.

#### Scenario: Into another project and back

- **WHEN** the owner clicks a call activity `ai-guardrails:install` in the marketplace's process
- **THEN** the page opens the newest `bpmn` snapshot of `ai-guardrails` on `main` at its process
  `install`, and the breadcrumb leads back to the marketplace's process

### Requirement: The C4 page walks the levels

`/c4/<id>` SHALL open on the context view and SHALL open, from a system, its container view, and
from a container that has components, its component view. A container without components SHALL
open no view. An external system that names a `project` SHALL open that project's newest `c4`
snapshot on `main`.

#### Scenario: From the context down to components

- **WHEN** the owner clicks qsm-marketplace on the context view, then qsm-models
- **THEN** the container view opens, then qsm-models' components, and qsm-cockpit, which has no
  components, opens nothing

### Requirement: An edit the graph forbids snaps back

On the BPMN page a rules module on `elements.move` SHALL refuse a move that takes a flow node into
another lane, and the node SHALL return to where it was. On the C4 page a container dragged outside
its system and a component dragged outside its container SHALL return to where they were.

#### Scenario: A task dragged into another lane (path p-1a2360)

- **WHEN** the owner drags "Review the graph" from the Review agent lane into the Owner lane, then
  renames a step, saves, and the agent applies the proposal and the gates pass
- **THEN** the task snaps back into its lane, the proposal holds only the rename, and the applied
  snapshot names the proposal as its parent

#### Scenario: A container dragged out of its system

- **WHEN** the owner drags qsm-docs outside the qsm-marketplace boundary on the container view
- **THEN** qsm-docs returns inside the boundary, and nothing is added to the proposal

### Requirement: Edit mode saves a proposal of the right kind

On the BPMN page, save SHALL create a `bpmn` snapshot of the whole edited XML whose parent is the
snapshot that was open. On the C4 page, save SHALL create a `c4-change` snapshot whose parent is the
`c4` snapshot that was open and whose changes are the owner's edits in order. A comment SHALL be
saved as a text annotation on the BPMN page and a `comment` change on the C4 page.

#### Scenario: The gates refuse an applied proposal (path p-285119)

- **WHEN** the owner renames a container, saves, and the agent applies the change to the `.c4`
  source and `check` fails on a link to the old name
- **THEN** the agent tells the owner which link failed, nothing is committed, and the proposal stays
  in `qsm-docs list --open`

### Requirement: diff names renames, moves and comments

`diff bpmn` SHALL compare two BPMN files with bpmn-js-differ 3.2.0 and print each element added,
removed, renamed (its name changed), changed (another property changed), moved (its geometry
changed) and commented (a text annotation added). `diff c4` SHALL compare two LikeC4 exports in the
same terms, and `diff c4-change` SHALL print the change list against its parent.

#### Scenario: Three edits named

- **WHEN** the owner renames a task, moves another and comments on a third, and saves
- **THEN** `qsm-docs diff <id>` prints one `renamed`, one `moved` and one `commented` line, each
  with the element's id and name

### Requirement: An applied move stays where it was put

When the agent applies a C4 `move`, it SHALL write the element's `layer` and `order` hints into the
`.c4` source; a BPMN move is applied with the proposal's geometry. The next `render` and the next
page SHALL draw the element where the owner put it.

#### Scenario: A move survives the render

- **WHEN** the owner moves qsm-docs before qsm-builder on the container view and the agent applies
  it
- **THEN** the next `render` and the C4 page both draw qsm-docs left of qsm-builder

### Requirement: A C4 node says how long ago it was verified

The C4 page SHALL show on each element with a `verified` commit how many commits of the checked-out
branch have come since, counted in the checkout the server runs in, and the commit alone when the
graph is another project's.

#### Scenario: Verified four commits ago

- **WHEN** qsm-tasks carries `verified` with a commit four commits behind HEAD
- **THEN** its box on the C4 page says "verified 4 commits ago"

### Requirement: A page says when the committed graph moved on

In repo mode the page SHALL say so when the graph's file in the checkout differs from the snapshot
it shows, and name the command that snapshots it.

#### Scenario: Committed but not snapshotted

- **WHEN** the agent committed a change to `models/marketplace.bpmn` and created no snapshot
- **THEN** the BPMN page says the checkout's file is newer and names `qsm-docs create bpmn
  models/marketplace.bpmn`

### Requirement: The pages request nothing outside 127.0.0.1

The BPMN and C4 pages SHALL bundle bpmn-js, its styles and every script they run in the kind's page
assets, and request nothing outside 127.0.0.1.

#### Scenario: A scripted run of both pages

- **WHEN** a scripted browser opens `/bpmn` and `/c4`, drills one level down in each and saves a
  proposal
- **THEN** every request it recorded went to 127.0.0.1
