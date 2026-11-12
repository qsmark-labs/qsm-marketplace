# Usage

```bash
qsm-tasks --help
qsm-tasks <verb> --help
```

`--json` prints one envelope on stdout. `ready` and `list` print one row per issue,
`#<n> [<Status>] <title>` with its priority, assignees and open blockers, or `none`; `list` reads
the open issues, and with `--feature` or `--spec` the whole tree or binding, open and closed.
`show` prints that row, the facts, the sub-issue counts and the body, and with `--comments` the
comments oldest first; `note` posts its text unchanged and prints `#<n> comment added`. A move,
`claim` or `unclaim`, prints `#<n> <from> -> <to>`; when its guard in `qsm-tasks flow` fails it
exits `blocked` and changes nothing. Every verb but `flow` needs `gh` on PATH with a login that has
the `project` scope.

Every verb but `flow` and `feedback` acts on a repository and its board, resolved on each run and
never stored: `--repo owner/name` where the verb takes it, else the repository `gh` resolves in the
working directory; `--project owner/number` where the verb takes it, else the one board linked to
that repository; a closed board does not count.

A failure exits with its outcome and names why in `data.reason`, and `data.next` holds the one
thing to do when there is one:

| Exit | Outcome | `data.reason` |
| --- | --- | --- |
| 1 | `failed` | `refused` (GitHub's words; a missing scope names `gh auth refresh -s project`), `not-found` |
| 2 | `usage` | none: a wrong call, or several open linked boards |
| 4 | `missing` | `no-gh`, `no-repo`, `no-board`, `no-file` |
| 5 | `blocked` | `wrong-kind`, `wrong-status`, `held`, `private-data` |
