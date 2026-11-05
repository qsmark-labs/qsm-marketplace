# Usage

```bash
qsm-docs create <kind> <file> [--parent <id>] [--project <p>] [--branch <b>] [--json]
qsm-docs get <id> [--json]
qsm-docs list <project> [--branch <b>] [--kind <k>] [--open] [--json]
qsm-docs diff <id> [<other>] [--json]
qsm-docs delete <id> [--json]
qsm-docs kind add <manifest> [--json]
qsm-docs kind list [--json]
qsm-docs kind remove <name> [--json]
qsm-docs serve [--port <n>] [--project <p>] [--branch <b>]
qsm-docs doctor [--json]
```

The project is the directory name of the repository's main worktree, so every worktree of one
repository is one project; the branch is the checked-out one. `--project` and `--branch` name them
outside a checkout. An id is `<project>-<branch>-<timestamp>`, the branch with each `/` as `_`, the
time in UTC to the millisecond (`qsm-marketplace-spec_qsm-docs-20261104T173012345Z`).

| Verb | Does | Exit |
| --- | --- | --- |
| `create` | Converts the file with its kind's converter, stores a read-only copy of its bytes and appends the ledger line with its sha256; prints the id | `failed` (1) naming the converter's message and nothing stored; `blocked` (5) when the id exists; `missing` (4) for a `--parent` or a kind that is not there; `usage` (2) outside git without both flags; `blocked` (5) on a detached HEAD without `--branch` |
| `get` | Prints the bytes exactly as created; `--json` puts them in `data.content` | `failed` (1) naming the id and both hashes when the file changed; `missing` (4) for an unknown or deleted id |
| `list` | One line per snapshot, newest first: id, kind, branch, time, parent, `page` or `cli`; `--open` keeps only page-made snapshots no later snapshot names as its parent | `usage` (2) for a name that is no project |
| `diff` | Runs the diff of `<id>`'s kind with the parent as `{a}` and `<id>` as `{b}`, or `<other>` as `{a}`; prints `<op> <element>` per change; `--json` prints the records | `usage` (2) for two kinds named or no parent; `failed` (1) when the kind printed another shape; `missing` (4) naming the kind and its plugin when it is gone |
| `delete` | Removes the snapshot's file and records the delete in the ledger; the agent is denied it, the owner runs `! qsm-docs delete <id>` | `missing` (4) for an unknown id |
| `kind add` | Installs a kind from its manifest and copies its page directory into the store; a second add replaces the copy | `usage` (2) for a manifest missing a field or a page directory without `index.html` |
| `kind list` | `json` first, then each installed kind with its media type, extension and plugin | |
| `kind remove` | Removes the kind and its page files; its snapshots stay | `missing` (4) when it is not installed; `usage` (2) for `json` |
| `serve` | Listens on 127.0.0.1 (port 4748 by default, `0` picks one) until Ctrl-C | `failed` (1) when the port is taken |
| `doctor` | Says whether `git` is on PATH, the one program the binary needs | `missing` (4) without git |

## A kind's manifest

```json
{
  "name": "bpmn",
  "plugin": "qsm-models",
  "mediaType": "application/xml",
  "ext": "bpmn",
  "pages": "pages/bpmn",
  "convert": ["qsm-models", "convert", "{file}"],
  "diff": ["qsm-models", "diff", "{a}", "{b}"]
}
```

`pages` is relative to the manifest and holds `index.html`. `convert` prints the document as JSON
on stdout and exits non-zero on a file it cannot read. `diff` prints a JSON array of change
records, each `{"op", "element"}` with an optional `"detail"` string, `op` one of `added`,
`removed`, `changed`, `renamed`, `moved`, `commented`.

## The pages

| Address | Shows |
| --- | --- |
| `/` | The installed kinds of the server's project |
| `/<kind>` | The newest snapshot of the kind on the branch of the checkout the server runs in |
| `/<kind>/<id>` | That snapshot: project, branch, id, parent, time, the snapshots of its branch, and the kind's page in a frame |
| `/kinds/<kind>/index.html#id=<id>` | The kind's page; `&edit=1` in edit mode |

A kind page reads `GET /api/snapshots/<id>` (the stored bytes with the kind's media type) and
`GET /api/snapshots/<id>/json` (the converter's output), and saves with `POST /api/snapshots`, a
JSON body `{"kind", "parent", "content"}`, answered `201` with `{"id"}`: a proposal in the
parent's project and branch. A failure is `{"code", "message"}` with status 400 (`usage`), 404
(`missing`), 409 (`blocked`) or 422 (`failed`). A post without a JSON content type or a loopback
`Origin`, and any request whose `Host` is not 127.0.0.1 or localhost on the server's port, is
refused with 403. Every response carries a content security policy of `'self'`.
