# Install

```bash
bun plugins/qsm-tasks/scripts/install.ts
```

The installer uses `bun` to compile `qsm-tasks` into `QSM_BIN_DIR` (default `~/.local/bin`) and
writes its completion. It checks for `br`, which the skills use. `--dry-run` prints the plan and
shows the upstream install command if `br` is missing. The binary itself requires `gh`.

Install the plug-in with `claude plugin install qsm-tasks@qsm-marketplace`. After installation,
run `qsm-setup doctor qsm-tasks` to check both tools.
