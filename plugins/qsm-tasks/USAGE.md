# Usage

```bash
qsm-tasks --help
qsm-tasks <verb> --help
```

`--json` prints one envelope on stdout. Every verb but `flow` needs `gh` on PATH with a login that
has the `project` scope.

A failure exits with its outcome and names why in `data.reason`, and `data.next` holds the one
thing to do when there is one:

| Exit | Outcome | `data.reason` |
| --- | --- | --- |
| 1 | `failed` | `refused` (GitHub's words; a missing scope names `gh auth refresh -s project`), `not-found` |
| 2 | `usage` | none: a wrong call |
| 4 | `missing` | `no-gh`, `no-repo`, `no-board`, `no-file` |
| 5 | `blocked` | `wrong-kind`, `wrong-status`, `held`, `private-data` |
