# Install

```bash
bun plugins/qsm-tasks/scripts/install.ts
```

The installer uses `bun` to compile `qsm-tasks` into `QSM_BIN_DIR` (default `~/.local/bin`) and
writes its completion. `--dry-run` prints the plan. Install and health checks work without `br`.
A fresh install needs npm registry access or a Bun cache with the locked test dependencies.

Install the plug-in with `claude plugin install qsm-tasks@qsm-marketplace`. After installation,
run `qsm-setup doctor qsm-tasks` to check that the binary can find `gh`.
