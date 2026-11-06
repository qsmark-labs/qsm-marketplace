## Purpose

An immutable store of document snapshots, a kind registry other plugins fill, and one page server on
127.0.0.1 where an edit becomes a proposal the agent hears of, so every generated page persists.

## ADDED Requirements

### Requirement: One binary, qsm-docs, serves the docs port

The plugin SHALL ship one binary `qsm-docs`, named after the plugin, with the verbs `doctor`, `get`,
`create`, `list`, `diff`, `delete`, `kind add`, `kind list`, `kind remove` and `serve` described in
`qsm.json`, and the noun `$.docs`. The CLI SHALL be the only door: no MCP server, no file another
plugin reads.

#### Scenario: Help lists every verb

- **WHEN** the owner runs `qsm-docs --help`
- **THEN** it lists the ten verbs with their descriptions from `qsm.json`, and no MCP server is
  registered by the plugin

### Requirement: create stores a snapshot and prints its id

`create <kind> <file> [--parent <id>]` SHALL convert the file with its kind's converter, store a
copy of the file's bytes, record its sha256, and print the id `<project>-<branch>-<timestamp>`, the
branch with every `/` written as `_` and the timestamp in UTC to the millisecond
(`20261104T173012345Z`). `get <id>` SHALL print exactly the bytes that were created.

#### Scenario: Created and read back

- **WHEN** the agent runs `qsm-docs create json state.json` on branch `spec/qsm-docs` of
  `qsm-marketplace`
- **THEN** it prints an id `qsm-marketplace-spec_qsm-docs-<timestamp>`, and `qsm-docs get <id>`
  prints the same bytes as `state.json`

### Requirement: create stores nothing it cannot keep

A file the kind's converter refuses SHALL fail `failed` with the converter's message, and nothing is
stored. An id that exists SHALL fail `blocked` and change nothing. A `--parent` that names no
snapshot SHALL fail `missing`.

#### Scenario: A file its kind cannot read

- **WHEN** `qsm-docs create json broken.json` runs on a file that is not JSON
- **THEN** it exits `failed` naming the converter's message, and `qsm-docs list` shows no new
  snapshot

### Requirement: No verb updates a snapshot

No verb SHALL write to a stored snapshot after `create`. `get` SHALL compare the file's sha256 with
the one recorded at create and fail `failed`, naming the id and both hashes, when they differ.

#### Scenario: The hash after a day of use

- **WHEN** a snapshot was created, then `get`, `list`, `diff`, `serve` and a save in edit mode ran
- **THEN** the snapshot file's sha256 equals the one recorded at create

#### Scenario: A file changed behind the store's back

- **WHEN** someone edits a snapshot file with a text editor and the agent runs `qsm-docs get <id>`
- **THEN** it exits `failed` naming the id and the two hashes, and prints no content

### Requirement: The project and branch come from the checkout

The project SHALL be the directory name of the repository's main worktree, so every worktree of one
repository is one project, and the branch SHALL be the checked-out branch. `--project` and
`--branch` SHALL name them outside a checkout. A detached HEAD without `--branch` SHALL fail
`blocked`, and a directory outside git without both flags SHALL fail `usage`.

#### Scenario: Two worktrees, one project

- **WHEN** the agent creates a snapshot in `.claude/worktrees/spec-qsm-docs-write` of the
  marketplace
- **THEN** its id starts with `qsm-marketplace-spec_qsm-docs-write-`, the same project as the main
  checkout

### Requirement: list shows snapshots newest first

`list <project> [--branch <b>] [--kind <k>] [--open]` SHALL print the snapshots of a project newest
first, each with its id, kind, branch, time, parent and whether a page made it. `--open` SHALL keep
only proposals no later snapshot names as its parent. A deleted snapshot SHALL not be listed.

#### Scenario: The newest on a branch

- **WHEN** three `json` snapshots were created on `main` of `demo` and one on `feature`
- **THEN** `qsm-docs list demo --branch main` prints the three newest first, and the first is the
  one a page opened without an id shows

### Requirement: diff names what changed through the kind

`diff <id> [<other>]` SHALL run the diff command of `<id>`'s kind with the parent as `{a}` and
`<id>` as `{b}`, whatever kind the parent is, or on the two snapshots named, and print one line per
change, `<op> <element>`. Two snapshots named of different kinds, or a snapshot without a parent and
no second id, SHALL fail `usage`.

#### Scenario: A JSON value changed

- **WHEN** a `json` snapshot was saved from the page with `title` changed and `tags` removed
- **THEN** `qsm-docs diff <id>` prints `changed title` and `removed tags` against its parent

#### Scenario: A change of another kind than its parent

- **WHEN** a `c4-change` snapshot was saved from the page of a `c4` snapshot and the agent runs
  `qsm-docs diff <change-id>`
- **THEN** the `c4-change` kind's diff command runs with the `c4` parent as `{a}`, and its changes
  are printed

### Requirement: Every kind's diff prints one change record shape

A kind's diff command SHALL print a JSON array of change records, each `{"op", "element"}` with an
optional `"detail"` string, where `op` is `added`, `removed`, `changed`, `renamed`, `moved` or
`commented` and `element` is the id or path it names. Any other output SHALL fail `failed` naming
the kind and the first record that does not fit. `diff --json` SHALL print the records unchanged.

#### Scenario: A kind prints another shape

- **WHEN** a kind's diff command prints `{"changes": 3}` and the agent runs `qsm-docs diff <id>`
- **THEN** it exits `failed` naming the kind and the record that does not fit, and prints no change

### Requirement: A kind is a manifest another plugin installs

`kind add <manifest>` SHALL install a kind from a JSON manifest that names the kind, the plugin that
installs it, its media type and file extension, a directory of page assets, the command that
converts a file to JSON on stdout, and the command that diffs two files to a JSON list of changes.
It SHALL refuse a manifest missing any of these, or a page directory without `index.html`, with
`usage`.

#### Scenario: qsm-models installs its kinds

- **WHEN** qsm-models' installer runs `qsm-docs kind add` with the manifests of `bpmn`, `c4` and
  `c4-change`
- **THEN** `qsm-docs kind list` prints the three with their media types, and `qsm-docs create bpmn
  models/marketplace.bpmn` converts the file before it stores it

### Requirement: kind add keeps its own copy of the page files

`kind add` SHALL copy the manifest's page directory into qsm-docs' own data, so the kind keeps
working when the installing plugin's tree moves, and SHALL replace that copy when the kind is added
again.

#### Scenario: The installing tree is rebuilt

- **WHEN** qsm-models added its kinds, then its plugin directory was deleted and built again
- **THEN** `qsm-docs serve` still shows a `bpmn` snapshot's page

### Requirement: A removed kind leaves its snapshots

`kind remove <name>` SHALL remove the kind and its page assets and leave every snapshot of it.
`create`, `diff` and a page of a kind that is not installed SHALL fail `missing` naming the kind.

#### Scenario: A snapshot of a kind that is gone

- **WHEN** the `bpmn` kind was removed and the agent runs `qsm-docs diff <bpmn-id>`
- **THEN** it exits `missing` naming the kind `bpmn` and the plugin to install

### Requirement: The json kind is built in

The plugin SHALL ship the kind `json`: its converter checks the file is JSON and prints it, its diff
names each path added, removed or changed, and its page shows the document and edits it as text,
saving only text that parses.

#### Scenario: A JSON document edited on the page

- **WHEN** the owner opens a `json` snapshot, enters text that does not parse and presses save
- **THEN** the page says where the text fails to parse and saves nothing

### Requirement: serve shows every kind's page on 127.0.0.1

`serve [--port]` SHALL listen on 127.0.0.1 only and serve the page shell: the project, the branch,
the snapshot's id, parent and time, and the snapshots of its branch, with the kind's page inside it.
`/<kind>/<id>` SHALL open that snapshot, and `/<kind>` the newest snapshot of the kind on the branch
of the checkout the server runs in. Every response SHALL carry a content security policy that allows
nothing outside 127.0.0.1, and no page SHALL request anything outside it.

#### Scenario: A page opened without an id

- **WHEN** the owner opens `/json` while the server runs in a checkout of `demo` on `main`
- **THEN** the page shows the newest `json` snapshot of `demo` on `main`, with its id and time

#### Scenario: Nothing leaves the machine

- **WHEN** a scripted browser opens every page of a served store and records each request
- **THEN** every request went to 127.0.0.1

### Requirement: The shell shows a kind page in a frame

The shell SHALL show a kind's `index.html` in a frame at `/kinds/<kind>/index.html#id=<id>`, with
`&edit=1` in edit mode, and serve the kind's other page files under `/kinds/<kind>/`.

#### Scenario: Edit mode reaches the kind page

- **WHEN** the owner turns on edit mode on a `json` snapshot's page
- **THEN** the frame's address ends in `#id=<id>&edit=1` and the `json` page offers its text editor

### Requirement: A kind page talks to the server through one API

A kind page SHALL read the snapshot with `GET /api/snapshots/<id>`, which returns the stored bytes
with the kind's media type, and `GET /api/snapshots/<id>/json`, which returns the converter's
output. It SHALL save with `POST /api/snapshots`, a JSON body `{"kind", "parent", "content"}`,
answered `201` with `{"id"}`.

#### Scenario: A page saves an edit

- **WHEN** the `json` page posts `{"kind": "json", "parent": "<id>", "content": "{}"}`
- **THEN** the server answers 201 with the new id, and `qsm-docs list --open` names it

### Requirement: A failed request names its code

Every failed request SHALL be answered `{"code", "message"}` with the content security policy, and
the status of its code: `usage` 400, `missing` 404, `blocked` 409, `failed` 422, and 500 for a
failure the store did not name.

#### Scenario: An address that does not decode

- **WHEN** the owner opens `/api/snapshots/%E0`
- **THEN** the server answers 400 with `{"code": "usage", ...}` and the content security policy

### Requirement: The server answers only its own pages

A `POST` without a JSON content type or a loopback `Origin`, and any request whose `Host` is not
127.0.0.1 or localhost on the server's port, SHALL be refused with 403, because any page in the
browser can reach 127.0.0.1.

#### Scenario: A post from another site

- **WHEN** a page from another origin posts a snapshot to the server
- **THEN** the server answers 403 and `qsm-docs list` shows no new snapshot

### Requirement: Edit mode saves a proposal

The page shell SHALL offer edit mode on every kind. Saving SHALL create a new snapshot of the page's
kind, or of the kind the kind's page names, whose parent is the snapshot that was open, marked as
made by a page. The snapshot that was open SHALL not change.

#### Scenario: The owner saves an edit (path p-9186ca)

- **WHEN** the owner opens a document, edits it in edit mode and saves, and the agent, told of the
  proposal, reads it and its diff and finds it does not apply cleanly
- **THEN** the proposal is a new snapshot whose parent is the one he opened, the agent tells him
  what blocks it, and the proposal stays open in `qsm-docs list --open`

#### Scenario: The agent applies a proposal (path p-3247dd)

- **WHEN** the agent reads a proposal and its diff and it applies cleanly
- **THEN** the agent creates the applied snapshot with `--parent <proposal>`, and the proposal
  leaves `qsm-docs list --open`

### Requirement: The agent hears of a new proposal

A hook SHALL, on the first prompt of a session, give one line naming the open proposals of the
session's project, and on each later prompt, one line per proposal created since the last line of
this session. It SHALL say nothing when there is none. It SHALL keep what it already named in the
plugin's store under the session's id and remove that key at session end.

#### Scenario: Saved in the browser, named on the next prompt (path p-3247dd)

- **WHEN** the owner saves a proposal in the browser while a session of that project is open
- **THEN** the agent's next prompt carries one line naming the proposal's id and kind, and the
  prompt after it carries none

#### Scenario: A session starts with an open proposal (path p-9186ca)

- **WHEN** a proposal is open and a new session of that project starts
- **THEN** the session's first prompt carries one line naming it

### Requirement: Only the owner deletes a snapshot

`delete <id>` SHALL remove the snapshot's file and record the delete in the ledger. A hook SHALL
deny every Bash call of the agent that runs `qsm-docs delete`, in any position of the command line
and through any path to the binary or its script, or that removes, moves, overwrites or truncates a
file under qsm-docs' data directory, and name the same command after `!` as what the owner runs.

#### Scenario: The owner deletes a snapshot (path p-c81356)

- **WHEN** the agent runs `qsm-docs delete <id>`, the guard denies it, the agent asks the owner and
  the owner runs `! qsm-docs delete <id>`
- **THEN** the snapshot is gone from `qsm-docs list`, and the ledger records the delete

#### Scenario: The owner keeps it (path p-b238a7)

- **WHEN** the guard denied the agent's delete and the owner answers no
- **THEN** the snapshot stays and `qsm-docs get <id>` still prints it

#### Scenario: The agent removes the file instead

- **WHEN** the agent runs `rm ~/.local/share/qsm-docs/projects/demo/<id>.json`
- **THEN** the guard denies it, names `! rm ~/.local/share/qsm-docs/projects/demo/<id>.json`, and
  the snapshot stays

#### Scenario: A mistake, not an evasion

- **WHEN** the agent runs `python3 -c "import shutil; shutil.rmtree('<data>/qsm-docs')"`, or feeds a
  shell on stdin, or builds the path from a variable set earlier on the line
- **THEN** the guard does not see it: it stops the commands an agent runs by mistake, at a command
  position and on a path written in the line, and a deliberate evasion is outside what it promises

#### Scenario: A mention is no call

- **WHEN** the agent runs `grep -rn "qsm-docs delete" plugins`
- **THEN** the guard lets it run

### Requirement: No marketplace prompt or hook deletes a snapshot

A gate SHALL fail naming the file and line when any skill, agent, command or hook of the
marketplace calls `qsm-docs delete` or `$.docs.delete`. A comment line in code and the owner's form
`! qsm-docs delete` SHALL not count as a call.

#### Scenario: A skill that deletes

- **WHEN** a skill of the marketplace holds the line `qsm-docs delete "$id"`
- **THEN** the gate fails naming the skill's file and line

### Requirement: Dependencies

The plugin SHALL declare no plug-in in `dependencies` and SHALL need only `git` on PATH.

#### Scenario: Installed alone

- **WHEN** only qsm-docs is installed
- **THEN** every verb runs with the `json` kind, and `serve` shows its page
