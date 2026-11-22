# Install

```bash
bun plugins/qsm-tasks/scripts/install.ts
```

Needs `bun`, `br` for the skill and `gh` for the binary. The installer compiles `qsm-tasks`, links
the binary into `QSM_BIN_DIR` (default `~/.local/bin`) and writes its completion. `--dry-run` prints
the plan. The plug-in itself installs with `claude plugin install qsm-tasks@qsm-marketplace`.
