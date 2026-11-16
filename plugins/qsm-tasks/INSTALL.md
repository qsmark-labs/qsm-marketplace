# Install

```bash
claude plugin install qsm-tasks@qsm-marketplace
qsm-setup install qsm-tasks
```

Compiles `qsm-tasks` into `$QSM_BIN_DIR` (default `~/.local/bin`, must be on `PATH`) and checks
that `br` is there for the skills. `--dry-run` previews. Neither `gh` nor `br` is installed for
you: install `gh` and log in with the `project` scope (`gh auth login -s project`), and install
`br` from its upstream line the check prints.
