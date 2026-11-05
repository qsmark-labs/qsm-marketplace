# qsm-docs

A store of document snapshots that never change, and one page server on 127.0.0.1 where the owner
reads a project's documents and edits them, each edit a proposal the agent hears of.

## Why it exists

A generated page is written once and thrown away, and an edit the owner makes in a browser reaches
nobody, so every plugin that wants a page builds its own server and its own store. This plug-in
keeps every snapshot exactly as it was made, serves each kind of document through one shell on the
machine alone, and turns a save into a proposal the agent is told of. It refuses to update a
snapshot, to let an agent delete one, to know any document format itself, or to request anything
outside 127.0.0.1. It would have no reason to exist if the harness kept and served the documents a
plugin generates and carried the owner's edits back to the agent by itself.

## What you get

| Kind | Name | What it does |
| --- | --- | --- |
| Tool | `qsm-docs create` | Converts a file with its kind's converter and stores a read-only copy; prints the id `<project>-<branch>-<timestamp>` |
| Tool | `qsm-docs get` | Prints a snapshot exactly as created, after checking its sha256 |
| Tool | `qsm-docs list` | A project's snapshots newest first; `--open` the proposals nothing applied yet |
| Tool | `qsm-docs diff` | What changed against the parent, through the kind's diff, as one change record shape |
| Tool | `qsm-docs delete` | The owner's verb: removes a snapshot and records it; the agent is denied |
| Tool | `qsm-docs kind add`, `kind list`, `kind remove` | The kinds other plugins install from a manifest, each with its own copy of its page files |
| Tool | `qsm-docs serve` | The page shell on 127.0.0.1 with each kind's page in a frame, and edit mode, where a save is a proposal |
| Hook | `prompt.submit`, `session.end` | One line per new proposal of the session's project, the first prompt naming every open one; what a session named is forgotten when it ends |
| Hook | `tool.call` on Bash | Denies `qsm-docs delete` to the agent and names `! qsm-docs delete <id>` for the owner |

## Install

```bash
bun plugins/qsm-docs/scripts/install.ts
claude plugin install qsm-docs@qsm-marketplace
```

It needs `git` on PATH and nothing else; the shell and the `json` page are compiled into the binary.
[INSTALL.md](INSTALL.md) has the detail.

## Use

```bash
qsm-docs create json state.json          # prints qsm-marketplace-main-20261104T173012345Z
qsm-docs get <id>
qsm-docs serve                           # http://127.0.0.1:4748/json
qsm-docs list qsm-marketplace --open
qsm-docs diff <proposal-id>
```

[USAGE.md](USAGE.md) has every verb, the manifest of a kind, the page API and the exit codes.

## Caveats

- The store lives in `$XDG_DATA_HOME/qsm-docs` (`~/.local/share/qsm-docs`): one directory per
  project, a read-only file per snapshot and an append-only `ledger.jsonl`.
- Two creates in one millisecond get one id; the second is refused `blocked` and is run again.
- An open proposal is named at the start of every session of its project until the agent applies
  it with `--parent <proposal>` or the owner deletes it.
