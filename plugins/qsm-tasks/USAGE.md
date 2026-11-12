# Usage

```bash
qsm-tasks --help
qsm-tasks <verb> --help
```

`--json` prints one envelope on stdout. `ready` and `list` print one row per issue,
`#<n> [<Status>] <title>` with its priority, assignees and open blockers, or `none`; `list` reads
the open issues, and with `--feature` or `--spec` the whole tree or binding, open and closed.
`show` prints that row, the facts, the sub-issue counts and the body, and with `--comments` the
comments oldest first; `note` posts its text unchanged and prints `#<n> comment added`. `feature`
and `add` print `#<n> filed: <title>`; a body or an intent goes to GitHub on stdin. `edit` prints
`#<n> edited`, `close` posts its reason, then prints `#<n> closed as <reason>`. `feedback` always
files in `$QSM_MARKETPLACE`'s repository, refuses private data as `blocked` `private-data` naming
the kind and line, and comments on the same open feedback instead of filing it twice. `doctor`
prints one line per check, `ok`, `failed` with its fix, or `manual` where the API cannot read it,
and exits `failed`, `partial` when only `manual` ones are left, or `ok`; it writes nothing. `setup`
creates the fields, options and labels doctor would fail, never renames or deletes, then prints
doctor's lines; a second run prints `nothing to create`. A move,
`claim`, `unclaim`, `review`, `reopen`, `plan` or `qa`, prints `#<n> <from> -> <to>`; when its guard
in `qsm-tasks flow` fails it exits `blocked` and changes nothing. Every verb but `flow` needs `gh`
on PATH with a login that has the `project` scope.

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
