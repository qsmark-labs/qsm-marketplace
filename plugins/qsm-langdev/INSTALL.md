# Install

```bash
claude plugin install qsm-langdev@qsm-marketplace
qsm-setup install qsm-langdev
```

`qsm-setup install` runs the plugin's installer. It compiles `qsm-langdev` into `$QSM_BIN_DIR`
(default `~/.local/bin`) and the stop gate hook into `dist/`. Installs `rumdl` with
`uv tool install` when it is absent. Builds `sentrux` (needs `cargo`; without it install reports
`missing-prereq`). `--dry-run` shows the plan. Other checker binaries are never installed:
`qsm-langdev doctor` names them.
