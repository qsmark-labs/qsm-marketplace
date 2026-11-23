# qsm-tasks Specification

## Purpose

qsm-tasks is the plug-in that serves the task port: the role every plan, spec and review flow names
when it says "the task", answered here by `br` (beads_rust). It holds the task model (what an epic
and a task are, when each is created and when each closes), the installer that builds
`qsm-tasks` and checks for `br`, and the one skill that teaches the `br` commands. A different
tracker would replace this plug-in and leave its users untouched.

## Requirements

### Requirement: Epics hold the intent of a piece of work, tasks hold one spec change

The `task-tool` skill SHALL state the task model. An epic SHALL hold the intent of one piece of
work and its acceptance criteria. Each spec change SHALL have exactly one task under the epic,
created together with the spec and never before. Subtasks SHALL NOT be created in the tracker: the
change's `tasks.md` holds that breakdown. Every epic SHALL have a final test-it task that runs the
real path end to end. A follow-up, a side finding, a decision to make and tool feedback SHALL each
be a task, never prose. A fix, a change that needs no spec, SHALL get no epic and no task.

#### Scenario: A spec change is planned

- **WHEN** a spec change is created under an epic
- **THEN** one task under that epic is created with it, naming the change, and no task for the
  change's steps is created

#### Scenario: A fix

- **WHEN** the work is a fix
- **THEN** the agent creates neither an epic nor a task, and the commit message carries the why

#### Scenario: A finding that is not the ask

- **WHEN** the agent finds work while doing another task
- **THEN** it creates a task that records the task it was working on as where it was discovered

### Requirement: An epic closes only when the work is proven and pushed

The skill SHALL state the close rule of an epic: every task done, every acceptance criterion
holding, the test-it task passed, and the work pushed after review. After each task closes the
agent SHALL check whether the epic is eligible. A task closes with a reason a reader in a month
understands, and finished work with its task left open, or an epic left open with all its tasks
closed, SHALL be a failure.

#### Scenario: The last task closes, a criterion does not hold

- **WHEN** the last open task of an epic closes but an acceptance criterion has not been shown to
  hold
- **THEN** the epic stays open and the reply names the criterion

#### Scenario: Everything holds

- **WHEN** all tasks are done, all criteria hold, test-it passed and the work is pushed after review
- **THEN** the agent closes the epic with what it delivered and the reply says so

### Requirement: One skill names br

The `task-tool` skill SHALL be the one place that teaches the `br` commands. Other skills, agents
and instructions SHALL say "the task tool" and point at that skill. A task SHALL be created only by
the main agent, except feedback, which a subagent files into the marketplace tracker.

#### Scenario: Another file names the tracker binary

- **WHEN** a review finds a skill, an agent or an instruction file outside this plugin naming the
  tracker binary
- **THEN** the mention is replaced with "the task tool" and a pointer to the `task-tool` skill

### Requirement: Task text is written for a maintainer and a newcomer

The `task-writing` skill SHALL hold the form of the text of an epic or task, tool-neutral: a title
in the user's words, a plain summary, a before and after, done-when criteria that each pair an input
with an exact expected result, what is out of scope, and a decision with its rejected options. It
SHALL be the one owner of that form, and the `writing` skill SHALL point at it.

#### Scenario: A bug is filed

- **WHEN** the agent writes a task for a bug
- **THEN** the title is the problem in the user's words, the reproduction steps carry exact input
  and wrong output, and the cause is marked measured or guessed

#### Scenario: A criterion is vague

- **WHEN** a done-when line says "works" or "fast"
- **THEN** it is replaced with an input and an exact result, or a number

#### Scenario: A newcomer reads it

- **WHEN** a first-time contributor opens the task
- **THEN** the plain summary and the before and after tell them what changes without the precise
  section, which is marked so they can skip it

### Requirement: Install builds the binary and checks for br

`scripts/install.ts` SHALL use the shared install base to build `qsm-tasks` into the configured
bin directory and write its completion. It SHALL probe for `br` and, when it is missing, report
it as a missing prerequisite with the upstream install line.

#### Scenario: br is missing

- **WHEN** `br` is not on PATH
- **THEN** the install reports `missing-prereq` naming `br` and the upstream install command, and
  exits non-zero

#### Scenario: Repeat a successful install

- **WHEN** the installer has completed successfully and its inputs remain unchanged
- **THEN** the next install reports `already`

### Requirement: The binary reports whether gh is there

The plugin SHALL ship the binary `qsm-tasks`, whose verb `doctor` reports whether `gh`, the one
program the binary needs, is on PATH: healthy when it is, `missing` (exit 4) naming `gh` and the
line to fix it when it is not. It SHALL check nothing else.

#### Scenario: gh is on PATH

- **WHEN** `qsm-tasks doctor` runs with `gh` on PATH
- **THEN** it ends `ok` (exit 0) and says the plugin is healthy

#### Scenario: gh is missing

- **WHEN** `qsm-tasks doctor` runs without `gh` on PATH
- **THEN** it ends `missing` (exit 4), names `gh` and says to install the GitHub CLI

#### Scenario: A hooks module calls doctor

- **WHEN** Claude Code loads the plugin's hooks module and calls `$.tasks.doctor()`
- **THEN** the noun runs `qsm-tasks doctor --json` and returns the success envelope's data

### Requirement: Setup doctor checks the binary and skills

The plugin SHALL declare a health probe that calls `qsm-tasks doctor` and checks for `br` on
PATH for the retained skills.

#### Scenario: Required tools are missing

- **WHEN** `qsm-setup doctor qsm-tasks` runs with the binary installed and `gh`, `br` or both
  missing
- **THEN** it reports FAIL with guidance for each missing tool

### Requirement: Dependencies

The plugin SHALL declare no other plug-in in `dependencies`. The installer requires Bun to
build the binary, the `task-tool` skill requires `br`, and the binary requires `gh`.

#### Scenario: Installed alone

- **WHEN** only qsm-tasks is installed in a session
- **THEN** the `task-tool` skill loads and every command it names runs with `br` on PATH, and the
  session needs no other plugin
