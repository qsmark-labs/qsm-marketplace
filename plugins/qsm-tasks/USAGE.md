# Usage

```bash
qsm-tasks --help
qsm-tasks <verb> --help
```

`--json` prints one envelope on stdout. Every verb but `flow` needs `gh` on PATH with a login that
has the `project` scope.

Every verb but `flow` and `feedback` acts on a repository and its board, resolved on each run and
never stored: `--repo owner/name` where the verb takes it, else the repository `gh` resolves in the
working directory; `--project owner/number` where the verb takes it, else the one board linked to
that repository.

A failure exits with its outcome and names why in `data.reason`, and `data.next` holds the one
thing to do when there is one:

| Exit | Outcome | `data.reason` |
| --- | --- | --- |
| 1 | `failed` | `refused` (GitHub's words; a missing scope names `gh auth refresh -s project`), `not-found` |
| 2 | `usage` | none: a wrong call, or several linked boards and no `--project` |
| 4 | `missing` | `no-gh`, `no-repo`, `no-board`, `no-file` |
| 5 | `blocked` | `wrong-kind`, `wrong-status`, `held`, `private-data` |
