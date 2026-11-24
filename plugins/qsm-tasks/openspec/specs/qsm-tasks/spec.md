# qsm-tasks Specification

## Purpose

qsm-tasks is the plug-in that serves the task port: the role every plan, spec and review flow names
when it says "the task". It holds the task model, writing guidance, and the `qsm-tasks` CLI.
The retained `task-tool` skill teaches the `br` workflow pending the marketplace-wide migration
in [#6](https://github.com/qsmark-labs/qsm-marketplace/issues/6).

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

### Requirement: Install builds the binary

`scripts/install.ts` SHALL use the shared install base to build `qsm-tasks` into the configured
bin directory and write its completion. Installation SHALL work regardless of whether `br`
is present.

#### Scenario: br is missing

- **WHEN** the installer runs with Bun and `gh` on PATH and `br` absent
- **THEN** it builds the binary and exits successfully

#### Scenario: Repeat a successful install

- **WHEN** the installer has completed successfully and its inputs remain unchanged
- **THEN** the next install reports `already`

### Requirement: The binary reports whether gh is there

The plugin SHALL ship the binary `qsm-tasks`, whose verb `doctor` reports whether `gh`, the one
program the binary needs, is on PATH: healthy when it is, `missing` (exit 4) naming `gh` and the
line to fix it when it is not. It SHALL check nothing else.

#### Scenario: A hooks module calls doctor

- **WHEN** Claude Code loads the plugin's hooks module and calls `$.tasks.doctor()`
- **THEN** the noun runs `qsm-tasks doctor --json` and returns the success envelope's data

#### Scenario: Setup checks plugin health without br

- **WHEN** `qsm-setup doctor qsm-tasks` runs with the binary and `gh` on PATH and `br` absent
- **THEN** it reports PASS

#### Scenario: gh is on PATH

- **WHEN** `qsm-tasks doctor` runs with `gh` on PATH
- **THEN** it ends `ok` (exit 0) and says the plugin is healthy

#### Scenario: gh is missing

- **WHEN** `qsm-tasks doctor` runs without `gh` on PATH
- **THEN** it ends `missing` (exit 4), names `gh` and says to install the GitHub CLI

### Requirement: The binary lists the open work with its Status

The verb `list` SHALL print every open issue of the repository of the current directory with its
Status on the board, one per line: `#<number>`, the Status, the title. It SHALL make one call,
`gh issue list --state open --limit 1000 --json number,title,projectItems`, and take the Status
from `projectItems[0].status.name`. An issue on no board, and one on the board with no Status set,
for which gh gives an empty name, SHALL print `no status`. With `--json` it
SHALL give the same as an array of `{ number, title, status }`, `status` null for none, inside the
envelope of the CLI stack. Only `lib/gh.ts` SHALL run `gh`: a non-zero exit is a `failed` error
carrying gh's stderr verbatim, and `gh` missing on PATH is a `missing` error that names `gh`.

#### Scenario: Open issues on the board

- **WHEN** `qsm-tasks list` runs and gh answers with issues that have a Status
- **THEN** each prints as `#<number>`, its Status and its title on one line

#### Scenario: An issue with no Status

- **WHEN** gh answers an issue whose `projectItems` is empty, or whose Status name is empty
- **THEN** its line reads `no status`, and under `--json` its `status` is null

#### Scenario: A title that spans lines

- **WHEN** a title holds a line break
- **THEN** it prints as one line, the break replaced by a space

#### Scenario: Data for a script

- **WHEN** `qsm-tasks list --json` runs
- **THEN** stdout is one envelope whose `data` is the array of `{ number, title, status }`

#### Scenario: gh fails

- **WHEN** gh exits non-zero
- **THEN** the verb ends `failed` (exit 1) and the message is gh's stderr as it came

#### Scenario: The list runs without gh

- **WHEN** `gh` is not on PATH
- **THEN** the verb ends `missing` (exit 4) and the message names `gh`

#### Scenario: gh answers in a shape the list does not know

- **WHEN** gh's output is not an array of `{ number, title, projectItems }` with a text Status name
- **THEN** the verb ends `failed` and names the element and field that did not fit

### Requirement: The binary files an issue

The verb `add "<title>" --body-file <file>` SHALL run
`gh issue create --title <title> --body-file <file>`, read the issue number from the URL gh prints
on stdout and print the number; `--body-file` SHALL be required. With `--parent <n>` it SHALL then
make the new issue a sub-issue of `<n>`: `gh api repos/{owner}/{repo}/issues/<new> --jq .id`, then
`gh api -X POST repos/{owner}/{repo}/issues/<n>/sub_issues -F sub_issue_id=<id>`. Output that does
not end in an issue URL, or an id that is not a number, SHALL fail with the text found. A failure
after the issue was filed SHALL name the issue's number, so a retry does not file it twice.

#### Scenario: A new issue

- **WHEN** `qsm-tasks add "a title" --body-file body.md` runs and gh prints the new issue's URL
- **THEN** it prints the number at the end of the URL

#### Scenario: A new sub-issue

- **WHEN** `qsm-tasks add "a title" --body-file body.md --parent 186` runs
- **THEN** the new issue's id is read and posted to `issues/186/sub_issues`, and the new number is
  printed

#### Scenario: The issue is filed and the sub-issue step fails

- **WHEN** `gh issue create` succeeded and reading the id or posting the sub-issue fails
- **THEN** the verb ends `failed` saying `issue #<new> was created` and why the step failed

#### Scenario: gh answers in a shape add does not know

- **WHEN** gh's output has no issue URL at its end, or the id is not a number
- **THEN** the verb ends `failed` and says what it found

#### Scenario: No body file

- **WHEN** `qsm-tasks add "a title"` runs without `--body-file`
- **THEN** it ends `usage` (exit 2) naming `body-file`

### Requirement: Dependencies

The plugin SHALL declare no other plug-in in `dependencies`. The installer requires Bun to
build the binary, the `task-tool` skill requires `br`, and the binary requires `gh`.

#### Scenario: Installed alone

- **WHEN** only qsm-tasks is installed in a session
- **THEN** the binary and both skills are available without another plugin, and the retained
  tracker commands in `task-tool` require `br`
