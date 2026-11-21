## ADDED Requirements

### Requirement: qsm-bpmn installs the bpmn kind into qsm-docs

The installer SHALL remove a `bpmn` kind an older install left, then install it with
`qsm-docs kind add`, its manifest naming the plugin `qsm-bpmn`, the media type, the extension
`.bpmn`, its page assets and the commands `qsm-bpmn convert bpmn {file}` and
`qsm-bpmn diff bpmn {a} {b}`.

#### Scenario: Installed twice

- **WHEN** qsm-bpmn is installed, then installed again
- **THEN** `qsm-docs kind list` shows `bpmn` once, and the second run names the kind it removed

### Requirement: convert turns a BPMN file into JSON

`convert bpmn <file>` SHALL print every process with its lanes and steps, each step with its id,
name, lane and Gherkin text when it has one, or fail `failed` naming what is wrong when the file is
not BPMN 2.0 XML.

#### Scenario: A file that is not BPMN

- **WHEN** `qsm-docs create bpmn notes.xml` runs on an XML file that is not BPMN 2.0
- **THEN** it exits `failed` with the converter's message, and nothing is stored

### Requirement: diff names changed steps and scenarios

`diff bpmn <a> <b>` SHALL compare the flow nodes of two BPMN files by id and print qsm-docs' change
records: `added`, `removed`, `renamed` when a name changed, and `changed` with detail `gherkin` when
a step's Gherkin text changed.

#### Scenario: Scenarios written under one step

- **WHEN** a proposal adds two scenarios under "Review the graph" and changes nothing else
- **THEN** `qsm-docs diff <id>` prints one `changed` line naming that step

### Requirement: The BPMN page walks the graph

`/bpmn/<id>` SHALL show the snapshot in the bpmn-js viewer, open on the main process. A call
activity SHALL open the process it calls, and a breadcrumb SHALL lead back up each level.

#### Scenario: Into a called process and back

- **WHEN** the owner clicks the call activity "2 Plan the feature" and then the first breadcrumb
- **THEN** the called process opens, and the breadcrumb returns to the main process

### Requirement: A step's details show its Gherkin

A click on a step SHALL open its details panel with its name, its lane and its Gherkin text, or say
that it has none. In edit mode the Gherkin text SHALL be a text field.

#### Scenario: A step without scenarios

- **WHEN** the owner clicks a step whose `documentation` holds no Gherkin
- **THEN** the panel shows its name and lane and says no scenarios are written yet

### Requirement: Saving scenarios makes a proposal

Save SHALL write the text into the step's `documentation` with `textFormat="text/x-gherkin"`,
removing it when the text is empty, and create a `bpmn` snapshot of the whole edited XML whose
parent is the snapshot that was open. Nothing else in the graph SHALL change.

#### Scenario: Two scenarios saved and applied (path p-1a2360)

- **WHEN** the owner writes two scenarios under "Review the graph" and saves, and the agent applies
  the proposal and the gates pass
- **THEN** `models/marketplace.bpmn` holds them in that step's `documentation`, the applied snapshot
  names the proposal as its parent, and the proposal leaves `qsm-docs list --open`

### Requirement: gherkin prints a graph's scenarios as feature text

`gherkin <graph> [--task <id>]`, the graph a `.bpmn` file or a `bpmn` snapshot id, SHALL print
`Feature:` and the process's name, then for each step with scenarios `Rule:` and the step's name
followed by the stored text, or only that step's rule with `--task`. A graph without any scenarios,
a step without them, and an unknown step id SHALL exit `failed` naming it.

#### Scenario: One step's scenarios

- **WHEN** `qsm-bpmn gherkin models/marketplace.bpmn --task review_graph` runs on a step that
  holds two scenarios
- **THEN** it prints the `Feature`, one `Rule: Review the graph` and the two scenarios as written

### Requirement: The page requests nothing outside 127.0.0.1

The BPMN page SHALL bundle bpmn-js, its styles and every script it runs in the kind's page assets.

#### Scenario: A scripted run of the page

- **WHEN** a scripted browser opens `/bpmn`, drills one level down, writes a scenario and saves
- **THEN** no new connection left 127.0.0.1
