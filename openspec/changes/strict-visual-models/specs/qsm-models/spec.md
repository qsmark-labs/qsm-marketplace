## Purpose

Strict visual models: BPMN for behaviour and C4 for structure, linted, rendered, walked into test
paths and checked against the code by one binary, so the owner, the agents and QA read one picture.

## ADDED Requirements

### Requirement: One binary, qsm-models, serves the model port

The plugin SHALL ship one binary `qsm-models`, named after the plugin, with the verbs `lint`,
`layout`, `render`, `paths` and `check` described in `qsm.json` and the noun `$.models`. It SHALL
read BPMN 2.0 XML files (`.bpmn`) and one C4 source format, and SHALL fail `missing` naming `dot`
when Graphviz is not on PATH.

#### Scenario: A verb runs without Graphviz

- **WHEN** `qsm-models render models/` runs on a machine with no `dot` on PATH
- **THEN** it exits `missing` naming `dot` and writes nothing

### Requirement: lint holds BPMN to the Analytic sub-class and to one actor per step

`lint` SHALL refuse a BPMN element outside the BPMN 2.0.2 Analytic sub-class, a flow out of an
exclusive or inclusive split without a label, a flow node in no lane or in two, a lane that names no
person or top-level system of the C4 model, and every rule of bpmnlint's recommended set, its
warnings as errors. Each finding SHALL name the file, the element id and the rule, and exit
`worse`.

#### Scenario: An unlabelled answer (path p-e28c8b)

- **WHEN** a split gateway "Findings?" has two outgoing flows and one has no label
- **THEN** `lint` exits `worse` naming the flow's id and the rule `split-flows-labelled`, and
  the agent fixes the model before it renders

#### Scenario: A lane nobody is

- **WHEN** a lane is named "Bot" and the C4 model has no person or system titled "Bot"
- **THEN** `lint` exits `worse` naming the lane and the C4 file it read

#### Scenario: An element outside Analytic

- **WHEN** a process holds a complex gateway
- **THEN** `lint` exits `worse` naming it as outside the Analytic sub-class

### Requirement: lint holds C4 to its levels

`lint` SHALL accept only the kinds person, system, container and component and the tags
`external` and `agent`, refuse a person or a system that has a parent, a container outside a
system, a component outside a container, a relation without a title, two elements with one title,
an internal container without a code path, and a source that declares its own kinds or views.

#### Scenario: A container inside a container

- **WHEN** a C4 source puts container B inside container A, which LikeC4 itself accepts
- **THEN** `lint` exits `worse` saying a container sits in a system, not in a container

### Requirement: layout never overwrites a drawn diagram

`layout <file.bpmn>` SHALL write the diagram geometry, pool and lanes included, into a BPMN file
that has none, deterministically, and SHALL exit `blocked` and change nothing when the file
already has geometry.

#### Scenario: The owner moved shapes in bpmn.io

- **WHEN** `layout` runs on a file the owner saved from bpmn.io
- **THEN** it exits `blocked` saying the file has a layout, and the file is unchanged

### Requirement: render commits a picture beside every source

`render` SHALL write `<name>.svg` beside each BPMN file, and for a C4 source one SVG per generated
view (`<name>.context.svg`, `<name>.containers.svg`, `<name>.components.svg` when they exist) and
one `<name>.drawio` whose shapes carry draw.io's C4 attributes. `render --check` SHALL write nothing
and exit `worse` naming each output that differs from what it would write.

#### Scenario: A model changed and its SVG did not (path p-95e6fc)

- **WHEN** a BPMN file is edited and committed without running `render`
- **THEN** `render --check` in the commit gate exits `worse` naming the stale SVG, and the commit is
  refused until it is rendered

#### Scenario: The picture is unreadable (path p-709f38)

- **WHEN** the agent looks at a rendered SVG and a label is cut or two shapes overlap
- **THEN** it changes the model and renders again before the model reaches a spec

### Requirement: paths lists the scenarios QA must cover

`paths <file.bpmn>` SHALL walk every path from a start to an end event, each flow taken at most
twice, and print the fewest paths it finds that together take every flow, each with an id that is a
hash of its flows and the answers it takes. `--all` SHALL print every path. With `--specs <dir>` it
SHALL exit `worse` naming each printed path no scenario cites and each cited id that does not exist.

#### Scenario: Every path is cited

- **WHEN** `paths flow.bpmn --specs specs/` runs on a change whose scenarios cite the seven ids of
  its cover
- **THEN** it prints the seven paths and exits `ok`

#### Scenario: A path with no end

- **WHEN** a task has no outgoing flow and is not an end event
- **THEN** `paths` exits `worse` naming it, because a path that does not end cannot be tested

### Requirement: check holds the C4 model to the code

`check` SHALL exit `worse` for an internal container whose path does not exist, a relation between
two internal containers that the source's `plugin.json` does not declare as a dependency, a
declared dependency with no relation, and a generated `.dependency-cruiser.models.cjs` that differs
from the model. `check --write` SHALL regenerate that file, one allowed rule per component relation.

#### Scenario: The model and the manifest disagree

- **WHEN** the model says qsm-plan uses qsm-tasks and `plugins/qsm-plan/.claude-plugin/plugin.json`
  declares no dependency on it
- **THEN** `check` exits `worse` naming both and the file to change

### Requirement: Dependencies

The plugin SHALL declare no plug-in in `dependencies`. Its prerequisite is the `dot` command of
Graphviz on PATH, checked by every verb that renders.

#### Scenario: Installed alone

- **WHEN** only qsm-models is installed and `dot` is on PATH
- **THEN** every verb runs on a model directory without any other plugin
