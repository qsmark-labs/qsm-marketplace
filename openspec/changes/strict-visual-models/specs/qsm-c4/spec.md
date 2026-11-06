## Purpose

Strict architecture models: one C4 graph per project in LikeC4, checked by `likec4 validate` and
this plugin's rules, laid out, rendered per level and shown as one page by one binary that works
alone, so the owner and the agents read one picture of the structure.

## ADDED Requirements

### Requirement: One binary, qsm-c4, serves the C4 port

The plugin SHALL ship one binary `qsm-c4`, named after the plugin, with the verbs described in
`qsm.json` and the noun `$.c4`. It SHALL read LikeC4 (`.c4`) and nothing else, lay views out by
elkjs and draw them itself.

#### Scenario: Rendered on a clean machine

- **WHEN** `qsm-c4 render models/` runs on a machine with no Graphviz, no browser and no qsm-bpmn
- **THEN** it writes every view, the same bytes as on any other machine

### Requirement: One C4 graph per project

A project SHALL have one C4 graph, `models/<project>.c4`, complete and usable alone. A verb pointed
at `models/` SHALL exit `failed` when it holds two `.c4` files.

#### Scenario: Two C4 graphs in one project

- **WHEN** `qsm-c4 lint models/` runs where `models/` holds `shop.c4` and `shop-old.c4`
- **THEN** it exits `failed` saying `models/` holds 2 `.c4` graphs and a project has one

### Requirement: The marketplace's C4 source migrates once into the one graph

The marketplace's C4 source, named in design decision 20, SHALL move once into
`models/marketplace.c4`, and the old file SHALL be deleted with `c4-kinds.c4`, whose vocabulary the
tool supplies.

#### Scenario: One C4 source left

- **WHEN** the migration has run
- **THEN** `models/marketplace.c4` is the only `.c4` file the marketplace keeps, and `qsm-c4 lint`
  passes on it

### Requirement: lint runs LikeC4's own check and holds C4 to the vocabulary

`lint` SHALL run `likec4 validate` on the source first, then accept only the kinds person, system,
container and component, the tags `external`, `agent`, `shared` and `artifact`, and the properties
`colour`, `group`, `path`, `layer` and `order`, and refuse a source that declares its own kinds or
views.

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

### Requirement: The colour of an actor is one colour everywhere

Every top-level person and every system tagged `agent` SHALL carry one colour from the palette
(navy, purple, orange, green, teal, red), no two the same. An external system SHALL be grey, a
container light blue, and a relation that starts inside the system grey and dashed. Every picture
SHALL carry a legend of the colours and shapes it uses. `lint` SHALL refuse an actor without a
colour and two actors with one.

#### Scenario: Two agents in one colour

- **WHEN** the QA agent and the Review agent are both orange
- **THEN** `lint` exits `worse` naming both and the colour

### Requirement: elements lists the graph for another tool

`elements [--json]` SHALL run the full lint and, when it passes, print every element of the graph
with its id, kind, title and tags, and for an actor its palette colour by name and hex. It is the
one door through which another tool reads the C4 graph.

#### Scenario: The QA agent's colour read from outside

- **WHEN** `qsm-c4 elements --json` runs on `models/marketplace.c4`
- **THEN** it lists the QA agent with its id, the kind system, the tag `agent` and the colour green
  with its hex, and exits `ok`

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

### Requirement: C4 views zoom in and out

In a C4 picture, an element that has a view of its own SHALL carry a dashed outline and be a link to
that view, and every view below level 1 SHALL link back to the view that shows its boundary; the
two halves of a split view SHALL link to each other.

#### Scenario: From the context down to components and back

- **WHEN** the owner clicks qsm-marketplace in the context view, then qsm-c4 in the container view
- **THEN** the component view of qsm-c4 opens, and its "Zoom out" link leads back to the container
  view, whose own link leads back to the context

### Requirement: A crowded view is split by question

A view with more than 15 relations SHALL be split into two views, who uses which element and how the
elements depend on each other. A container tagged `shared` SHALL draw no relations and carry a note
naming who uses it.

#### Scenario: The marketplace container view

- **WHEN** the marketplace container view would hold 50 relations among 5 actors and 34 containers
- **THEN** `render` writes `containers-uses` with the 18 relations the actors start and only the
  containers they reach, and `containers-depends` with every container and the 32 relations that
  start inside, each in tiers and actor colours, and each links to the other

### Requirement: Every verb that writes runs the full lint first

`render`, `elements` and `pages` SHALL run the full lint of the graph first, and on a finding SHALL
write nothing and exit as the lint did.

#### Scenario: A render of a source lint refuses

- **WHEN** `render` runs on a source that puts a container inside a container
- **THEN** it exits `worse` naming the container and the rule, and every view on disk is unchanged

### Requirement: An edit reaches the graph file only after the reviewer

The skill `model` SHALL write an edit into `models/<project>.c4`, the agent's own or one applied
from a page's proposal, only after the full lint passes and `model-reviewer` returns no finding. A
binary cannot run an agent, so the skill holds this step.

#### Scenario: The reviewer returns a finding on a clean source

- **WHEN** an edit passes `lint` and `model-reviewer` finds a relation whose title does not say what
  the spec says
- **THEN** the edit is not committed into `models/<project>.c4`, and the finding goes back to the
  agent

### Requirement: render measures the layout and refuses a worse one

`render` SHALL measure each view from its geometry: edge crossings, segments two edges share, total
and longest edge length, bends per edge, labels that touch a line or a box, and area per element,
each divided by the element count, and SHALL exit `worse` writing nothing when a measure grew
against the view it replaces, unless `--accept` names that measure.

#### Scenario: A new relation crosses the view

- **WHEN** a change adds a relation and edge crossings per element in the container view grow from
  0.2 to 0.5
- **THEN** `render` exits `worse` naming edge crossings and both numbers, and writes nothing

### Requirement: An applied move survives the next render

A C4 element MAY carry the layout hints `layer` (its tier, counted from 0) and `order` (its place
within the tier); `render` SHALL hand them to the layout as constraints in every view that draws the
element, so a move the owner made and the agent applied stays where it was put.

#### Scenario: qsm-docs moved left of qsm-builder

- **WHEN** the agent applies a move that puts qsm-docs before qsm-builder, as `order` hints on both
- **THEN** the next `render` draws qsm-docs left of qsm-builder in every container view, and a
  second render writes the same bytes

### Requirement: render commits a picture per view beside the graph

`render` SHALL write one `models/<project>.<view>.drawio.svg` per generated view: the picture, with
the view's draw.io diagram, its shapes carrying draw.io's C4 attributes, in the root element's
`content` attribute. `render --check` SHALL write nothing and exit `worse` naming each view that
differs, and the skill `model` SHALL run it before a commit.

#### Scenario: A source changed and its view did not

- **WHEN** the agent edits `models/marketplace.c4` after it rendered the views and is about to
  commit
- **THEN** `render --check` exits `worse` naming each stale `.drawio.svg`, and nothing is committed

### Requirement: The model skill takes any piece of work to a checked structure

The plugin SHALL ship a skill `model`: structure goes into the project's C4 graph, and the scale
decides where. A plugin gets a container, with components when its parts matter; the project gets
its context and container views; a task changes the graph only when a relation or a part changes.

#### Scenario: A feature adds a plugin

- **WHEN** a feature adds a plugin to the marketplace
- **THEN** the skill has the agent add a container with its code path and its relations, each with
  a title and a technology, run `lint` and `render`, and look at the views before the graph reaches
  the spec

### Requirement: A reviewer reads every structure change

The plugin SHALL ship an agent `model-reviewer`, on sonnet, that reads each changed view and its
source against the spec and the rules and returns findings, editing nothing.

#### Scenario: The reviewer finds a relation unclear

- **WHEN** a change passed lint and render, and the reviewer finds a relation whose title names no
  verb
- **THEN** the finding goes back to the agent, the source is edited, linted and rendered again, and
  the reviewer reads it once more before the owner does

### Requirement: pages writes one self-contained C4 page

`pages [--out <dir>]` SHALL run the full lint and, when it passes, write `c4.html` into
`<repo>/.qsm/models/`, which the repository's `.gitignore` names, replacing only the `c4.html` an
earlier run wrote. The page SHALL hold the generated views inside the file and SHALL request nothing
outside it.

#### Scenario: The page from a clean checkout

- **WHEN** `qsm-c4 pages` runs in a checkout with `models/marketplace.c4`, then a scripted browser
  opens the file from disk and records its requests
- **THEN** `.qsm/models/c4.html` exists, opens, and the browser made no request except for the file
  itself

#### Scenario: A project with no C4 graph

- **WHEN** `pages` runs where only `models/shop.bpmn` exists
- **THEN** it exits `failed` naming `models/` and writes nothing

### Requirement: The static page walks the levels

`c4.html` SHALL open on the context view and SHALL open the child view of a clicked element that has
one, with a link back.

#### Scenario: From the context down to the components

- **WHEN** the owner clicks qsm-marketplace on `c4.html`, then qsm-c4, then qsm-cockpit
- **THEN** the container view opens, then the components of qsm-c4, and qsm-cockpit, which has no
  components, opens nothing

### Requirement: Dependencies

The plugin SHALL declare no plug-in in `dependencies` and SHALL need no program on PATH: LikeC4 and
elkjs are compiled into its binary (design, Verify 4).

#### Scenario: Installed alone

- **WHEN** `claude plugin install qsm-c4` runs on a machine without qsm-bpmn
- **THEN** `qsm-c4 doctor` reports healthy and every verb runs
