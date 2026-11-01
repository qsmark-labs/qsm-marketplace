## MODIFIED Requirements

### Requirement: spec-propose creates an apply-ready change

Triggered by a request to propose a change, write a spec for a feature, or turn a settled brainstorm
into a plan, spec-propose SHALL write a change on the feature schema: a one-screen proposal, the
models (BPMN and C4, linted and rendered), delta specs whose scenarios cite the paths, and a design
of decisions and critiques. It SHALL write no task list, go back to grilling on an open decision,
edit no code, and commit the change only after the owner's yes.

#### Scenario: Settled brainstorm becomes a proposal

- **WHEN** a user hands spec-propose a brainstorm with its open questions
  already resolved
- **THEN** spec-propose SHALL create the proposal, the models, the delta specs and the design, no
  tasks.md, and SHALL NOT mark the change apply-ready until every required artifact and critique
  pass is present, and SHALL name the split as the next step once the owner said yes to the plan

#### Scenario: Code does not start without the person's yes

- **WHEN** the change is apply-ready and the owner has not merged its pull request
- **THEN** spec-propose SHALL NOT hand to the split

#### Scenario: An open decision sends it back to grilling

- **WHEN** the ask leaves a decision or the intent unsettled that the spec
  needs
- **THEN** spec-propose SHALL hand that question to the grilling skill and
  SHALL NOT write an artifact that guesses the answer

#### Scenario: A path no scenario cites

- **WHEN** the model tool lists a cover path of the change's BPMN that no scenario cites
- **THEN** spec-propose SHALL write the scenario or change the model before calling the change
  apply-ready

### Requirement: spec-apply implements only a complete change

Triggered by a request to build a task, spec-apply SHALL build one task of a planned feature in one
session: gather context (the feature, its change, memory, the code index, related pull requests),
show a whiteboard (the C4 component view it touches, interfaces, contracts), implement, run
`/simplify` and a self-review, and open a pull request into `feature/<n>` that closes the task.
It SHALL refuse a task whose feature change is a draft.

#### Scenario: Code without verification

- **WHEN** the task's code is written but the scenarios it touches have not run on the real path
- **THEN** spec-apply SHALL NOT open the pull request

#### Scenario: The task's pull request is opened

- **WHEN** the task's code runs, `/simplify` and the self-review are done
- **THEN** spec-apply SHALL open one pull request into `feature/<n>` from the template, closing
  the task, and SHALL name the review agent as the next step and SHALL NOT merge it

#### Scenario: Plan invalidated during implementation

- **WHEN** implementation shows that a decision the plan assumed no longer
  holds
- **THEN** spec-apply SHALL pause and route the change through spec-propose
  rather than deviating silently

#### Scenario: The whiteboard comes before the code

- **WHEN** spec-apply has gathered the context of a task
- **THEN** it SHALL show the component view, the interfaces and the contracts in the chat before
  the first edit, and SHALL write no plan file

### Requirement: spec-propose revises an existing change without touching code

Triggered by a request to revise a proposal, update a spec, or reconcile a change whose
requirements or design decisions moved, spec-propose SHALL revise the proposal, the models, the
delta specs and the design together so they stay coherent, and SHALL name each open task of the
feature whose work a changed decision invalidates. spec-propose SHALL NOT change planning artifacts
and code in the same move.

#### Scenario: A changed decision reopens a task

- **WHEN** a design decision changes after a task of the feature that depends on it was merged
- **THEN** spec-propose SHALL name that task and the decision, and the main agent SHALL file a fix
  task under the feature rather than leave the merged work standing against a plan it no longer
  matches

### Requirement: Dependencies

qsm-openspec SHALL declare `qsm-essentials`, `qsm-tasks`, `qsm-models` and `qsm-forge` in the
`dependencies` array of its plugin.json, each for one reason, and SHALL have no fallback for any.

- `qsm-essentials`: the core; spec-apply hands disjoint work to its subagents skill.
- `qsm-tasks`: serves the task port, where a change is bound to its feature.
- `qsm-models`: spec-propose lints, renders and walks the change's models.
- `qsm-forge`: spec-apply opens the task's pull request into `feature/<n>`.

qsm-openspec SHALL NOT depend on `qsm-plan`: the flow calls the spec port, never the reverse.

#### Scenario: The plugin is installed

- **WHEN** the plugin is installed
- **THEN** `claude plugin install` installs `qsm-essentials`, `qsm-tasks`, `qsm-models` and
  `qsm-forge` with it
