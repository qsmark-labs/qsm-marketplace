## Purpose

Strict business models: one BPMN graph per project, linted by bpmnlint and this plugin's rules,
laid out, rendered, walked into test paths and shown as one page by one binary that works alone,
so the owner, the agents and QA read one picture of the process.

## ADDED Requirements

### Requirement: One binary, qsm-bpmn, serves the BPMN port

The plugin SHALL ship one binary `qsm-bpmn`, named after the plugin, with the verbs described in
`qsm.json` and the noun `$.bpmn`. It SHALL read BPMN 2.0 XML (`.bpmn`) and nothing else, lay a
process out by bpmn-auto-layout and draw it by bpmn-js.

#### Scenario: Rendered on a clean machine

- **WHEN** `qsm-bpmn render models/` runs on a machine with no browser and no qsm-c4
- **THEN** it writes every picture of a graph that carries no C4 id, the same bytes as on any other
  machine

### Requirement: One BPMN graph per project

A project SHALL have one BPMN graph, `models/<project>.bpmn`, holding its main process and every
process a call activity calls, complete and usable alone. A verb pointed at `models/` SHALL exit
`failed` when it holds two `.bpmn` files.

#### Scenario: Two BPMN graphs in one project

- **WHEN** `qsm-bpmn lint models/` runs where `models/` holds `shop.bpmn` and `shop-old.bpmn`
- **THEN** it exits `failed` saying `models/` holds 2 `.bpmn` graphs and a project has one

### Requirement: The marketplace's BPMN files migrate once into the one graph

The marketplace's fourteen BPMN files, named in design decision 20, SHALL move once into
`models/marketplace.bpmn`, and the old files SHALL be deleted. Every path signature SHALL be kept,
every scenario that cites a changed path id SHALL cite the new id, and every proposal SHALL link
the pictures under the root `models/`.

#### Scenario: Fourteen files become one graph

- **WHEN** the migration has run
- **THEN** every signature of the fourteen old processes is in the one graph (`paths --compare`
  finds none missing once it exists, and `paths --all` of each process shows it before), and
  `paths --specs openspec/changes` exits `ok`

### Requirement: lint holds BPMN to the Analytic sub-class and to one lane per step

`lint` SHALL run bpmnlint with its recommended rules, warnings raised to errors, and this plugin's
rules as bpmnlint rules: an element outside the BPMN 2.0.2 Analytic sub-class, a flow out of an
exclusive or inclusive split without a label, and a flow node in no lane or in two. A lane SHALL
name a business role. Each finding SHALL name the file, the element id and the rule, and exit
`worse`.

#### Scenario: An unlabelled answer (path p-c6dc7d)

- **WHEN** a split gateway "Findings?" has two outgoing flows and one has no label, and once the
  graph is clean its cover path has no scenario yet
- **THEN** `lint` exits `worse` naming the flow's id and the rule `split-flows-labelled`, the agent
  fixes the graph before it renders, and writes the missing scenario before it commits

#### Scenario: A lane no C4 element names

- **WHEN** a lane is named "Accountant" and carries no C4 id
- **THEN** `lint` passes without running qsm-c4, because a lane is a business role

#### Scenario: An element outside Analytic

- **WHEN** a process holds a complex gateway
- **THEN** `lint` exits `worse` naming it as outside the Analytic sub-class

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
C4 id. The reviewer judges a name; `lint` refuses a name that holds a path or a command in
backticks.

#### Scenario: A step named after a command

- **WHEN** an activity is named "Run `qsm-tasks close`"
- **THEN** `lint` exits `worse` naming it, and the graph gets "Close the task"

### Requirement: A BPMN element may name a C4 element by a neutral attribute

A BPMN element MAY carry `c4:element="<id>"`, the prefix bound to the namespace
`https://c4model.com`, naming an element of the project's C4 graph. It SHALL be the graph's only
link to anything outside itself. A graph with no such attribute SHALL need no other plugin.

#### Scenario: A process with no C4 ids

- **WHEN** the BPMN graph carries no `c4:element` and qsm-c4 is not installed
- **THEN** `lint`, `layout`, `render`, `paths` and `pages` all run, and none starts qsm-c4

### Requirement: A C4 id is resolved through qsm-c4's CLI only

qsm-bpmn SHALL resolve every `c4:element` through `qsm-c4 elements --json` and SHALL never read a
`.c4` file. With an id present and no `qsm-c4` on PATH, the verb SHALL exit `missing` naming
qsm-c4, with no fallback.

#### Scenario: A C4 id and no qsm-c4

- **WHEN** a lane carries `c4:element="qa"` and `qsm-c4` is not on PATH
- **THEN** `lint` exits `missing` naming qsm-c4, and writes nothing

### Requirement: Every C4 id resolves or lint fails

`lint` SHALL exit `worse` naming each `c4:element` that names no element `qsm-c4 elements` lists,
and each lane linked to an actor whose colour is not that actor's colour. An absent id SHALL never
be a finding.

#### Scenario: A link that no longer resolves (path p-c6dc7d)

- **WHEN** a change renames the C4 container `mp.tasks` and a BPMN task still carries
  `c4:element="mp.tasks"`
- **THEN** `lint` exits `worse` naming the task, the id and the missing element, and the agent
  edits the graph again before it commits

### Requirement: A lane takes the colour of the actor it links to

A BPMN lane that names a C4 actor SHALL take that actor's colour, read from `qsm-c4 elements`; a
lane without one SHALL take the palette's colours not yet used, in lane order. The legend SHALL say
which actor each colour is.

#### Scenario: The QA agent in two pictures

- **WHEN** the QA agent is green in the C4 graph and a lane links to it
- **THEN** that lane is green in the BPMN picture and its legend says so

### Requirement: A BPMN picture reads at a glance

A BPMN picture SHALL draw lanes across with the flow left to right, each lane tinted and each step
filled in its lane's colour with white text, flows 3 px wide with a small arrow in the middle of
every segment longer than 70 px, and enough room that no flow touches a step or a label.

#### Scenario: The middle of a long flow

- **WHEN** the owner looks at the middle of the flow from "8.2 File a fix task per finding" back to
  the merge before "4-6 Build every open task" in the picture of the feature flow
- **THEN** a small arrow on that segment shows which way it runs

### Requirement: Diagrams link to each other

A call activity SHALL name a process of the same graph in `calledElement`, and `lint` SHALL refuse
one that names no process of the graph. `render` SHALL make each call activity a link to the
picture of the process it calls, and put above the pool of a called process one link back per step
that calls it, each relative to where the picture lives.

#### Scenario: From the flow into planning and back

- **WHEN** the owner clicks "2 Plan the feature" in the picture of the feature flow
- **THEN** the picture of planning opens, and its line "Called by "2 Plan the feature" in A feature
  from request to main" leads back

### Requirement: Every verb that writes runs the full lint first

`layout`, `render` and `pages` SHALL run the full lint of the graph first, the C4 ids included, and
on a finding SHALL write nothing and exit as the lint did. `layout` SHALL leave out only
`no-bpmndi`, the finding it exists to fix.

#### Scenario: A render of a graph lint refuses

- **WHEN** `render` runs on a graph with an unlabelled split answer
- **THEN** it exits `worse` naming the flow and the rule, and every picture on disk is unchanged

### Requirement: An edit reaches the graph file only after the reviewer

The skill `bpmn-model` SHALL write an edit into `models/<project>.bpmn`, the agent's own or one
applied from a page's proposal, only after the full lint passes and `model-reviewer` returns no
finding. A binary cannot run an agent, so the skill holds this step.

#### Scenario: The reviewer returns a finding on a clean graph

- **WHEN** an edit passes `lint` and `model-reviewer` finds a split whose answers do not say what
  the spec says
- **THEN** the edit is not committed into `models/<project>.bpmn`, and the finding goes back to the
  agent

### Requirement: render measures the layout and refuses a worse one

`render` SHALL measure each picture from its geometry: edge crossings, segments two edges share,
total and longest edge length, bends per edge, lane jumps per flow, labels that touch a line or a
box, and area per element, each divided by the element count, and SHALL exit `worse` writing
nothing when a measure grew against the picture it replaces. Only `--accept <measure>` SHALL pass
it, and the skill `bpmn-model` SHALL leave that flag to the owner to type, never the agent.

#### Scenario: A reordered lane makes flows jump further

- **WHEN** a change moves the QA lane above the Owner lane and lane jumps per flow grow from 0.6 to
  1.1
- **THEN** `render` exits `worse` naming lane jumps and both numbers, and writes nothing, and the
  agent restructures the graph or asks the owner, never typing `--accept` itself

### Requirement: layout never overwrites a drawn diagram

A graph's layout SHALL be its diagram geometry. `layout <file.bpmn>` SHALL write the geometry, pool
and lanes included, for each process of the file that has none, deterministically, and SHALL exit
`blocked` and change nothing when the process already has geometry; `render` draws it as it is.

#### Scenario: The owner moved shapes in bpmn.io

- **WHEN** `layout` runs on a file the owner saved from bpmn.io
- **THEN** it exits `blocked` saying the file has a layout, and the file is unchanged

### Requirement: render commits a picture beside the graph

`render` SHALL write `models/<project>.<process>.svg` per process of the graph. `render --check`
SHALL write nothing and exit `worse` naming each picture that differs, and the skill `bpmn-model`
SHALL run it before a commit.

#### Scenario: A graph changed and its SVG did not (path p-4ab902)

- **WHEN** the agent edits the BPMN graph after it rendered the pictures and is about to commit
- **THEN** `render --check` exits `worse` naming the stale SVG, nothing is committed, and the graph
  goes back to be edited, linted and rendered again

#### Scenario: The picture is unreadable (path p-66b9ca)

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

### Requirement: paths --compare checks what QA observes

A path's signature SHALL be its split answers in order and the name of its end event.
`paths --compare <old.bpmn> <new.bpmn>` SHALL exit `worse` naming each signature one graph has and
the other lacks. Merging two activities in a row keeps every signature; removing a split or an
answer does not. Keeping every signature SHALL NOT be enough to keep a rewrite.

#### Scenario: A simplification drops an answer (path p-9edef7)

- **WHEN** the simplify agent merges a split into the activity before it
- **THEN** `paths --compare` exits `worse` naming the signatures that lost the split's answers, and
  the rewrite is dropped

#### Scenario: Two steps in a row merge (path p-f914aa)

- **WHEN** the simplify agent merges two activities of one lane that follow each other
- **THEN** `paths --compare` finds every signature in both graphs, `lint` and the layout measures
  pass, and the rewrite is kept once `model-reviewer` has read the merged activity

#### Scenario: A merge keeps every signature but loses what an activity does (path p-855310)

- **WHEN** the simplify agent merges "Run the scenarios" into "File a fix task per finding", every
  signature is kept, and `model-reviewer` reads that the merged activity no longer says the
  scenarios run
- **THEN** the rewrite is dropped, and the report names the activity and the reviewer's reason

### Requirement: The model skill takes any piece of work to a checked process

The plugin SHALL ship a skill `bpmn-model`: behaviour goes into the project's BPMN graph, and the
scale decides where. A task changes a process only when it changes behaviour; a feature gets a
process of at most 10 activities and a called process per call activity; the project gets its main
process.

#### Scenario: A feature changes how a task is reviewed

- **WHEN** a feature adds a second review round to the task loop
- **THEN** the skill has the agent change the build-task process, not the feature flow, run `lint`
  and `render`, and look at the picture before the graph reaches the spec

#### Scenario: The owner asks for a change to a graph (path p-24a9fb)

- **WHEN** the owner reads a picture and it does not say what he wants
- **THEN** his request goes back to the agent, and the graph is edited, linted with its C4 ids,
  rendered and reviewed again before he reads it once more

### Requirement: A reviewer reads every process change

The plugin SHALL ship an agent `model-reviewer`, on sonnet, that reads each changed process picture
and its source against the spec and the rules and returns findings, editing nothing.

#### Scenario: The reviewer finds a graph unclear (path p-416f5e)

- **WHEN** a change passed lint and render, and the reviewer finds a split whose answers do not say
  what the spec says
- **THEN** the finding goes back to the agent, the graph is edited, linted and rendered again, and
  the reviewer reads it once more before the owner does

### Requirement: A simplifier runs on request

The plugin SHALL ship an agent `model-simplifier`, on opus, run only on request, that walks the
graph, proposes merges, splits and reorders as a change to the source, and keeps only the ones
`paths --compare`, `lint` and the layout measures accept and `model-reviewer` passes after reading
the changed activities.

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

### Requirement: pages writes one self-contained BPMN page

`pages [--out <dir>]` SHALL run the full lint and, when it passes, write `bpmn.html` into
`<repo>/.qsm/bpmn/`, under the `.qsm/` the repository's `.gitignore` names, replacing what an
earlier run wrote there and touching nothing else under `.qsm/`. The page SHALL hold the bpmn-js
Viewer at its pinned version, its styles and the graph inside the file, and SHALL request nothing
outside it.

#### Scenario: The page from a clean checkout

- **WHEN** `qsm-bpmn pages` runs in a checkout with `models/marketplace.bpmn`, then a scripted
  browser opens the file from disk and records its requests
- **THEN** `.qsm/bpmn/bpmn.html` exists, opens, and the browser made no request except for the
  file itself

#### Scenario: A project with no BPMN graph

- **WHEN** `pages` runs where only `models/shop.c4` exists
- **THEN** it exits `failed` naming `models/` and writes nothing

#### Scenario: A graph that fails lint

- **WHEN** `pages` runs on a graph with an unlabelled split answer
- **THEN** it exits `worse` naming the flow and the rule, and the file of the earlier run is
  unchanged

### Requirement: The static page walks the graph

`bpmn.html` SHALL open on the main process, SHALL open the process a clicked call activity calls
with a breadcrumb back, and SHALL show a clicked task's lane, name and its `documentation` of format
`text/x-gherkin` as read-only text.

#### Scenario: Into a called process and back

- **WHEN** the owner clicks the call activity "2 Plan the feature" on the page of the feature flow
- **THEN** the process of planning opens, the breadcrumb names both processes, and clicking the
  first leads back

#### Scenario: A task holding Gherkin notes

- **WHEN** a task's `documentation` has `textFormat="text/x-gherkin"` and the owner clicks the task
  on `bpmn.html`
- **THEN** its details show the lane, the name and the scenarios as text, and cannot be edited

### Requirement: Dependencies

The plugin SHALL declare no plug-in in `dependencies` and SHALL need no program on PATH. qsm-c4 is
no dependency: it is reached only for a graph that carries a C4 id, and fails `missing` there.

#### Scenario: Installed alone

- **WHEN** `claude plugin install qsm-bpmn` runs on a machine without qsm-c4
- **THEN** qsm-c4 is not installed with it, and `qsm-bpmn doctor` reports healthy
