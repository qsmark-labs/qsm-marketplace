# Install

```bash
bun plugins/qsm-c4/scripts/install.ts
```

Needs `bun`. The installer runs `bun install --frozen-lockfile` in the plugin, compiles `qsm-c4`
into `QSM_BIN_DIR` (default `~/.local/bin`) and writes its completion. `--dry-run` prints the plan.
LikeC4 and elkjs are compiled into the binary, so it needs no program on PATH, no browser and no
Graphviz. The plug-in itself installs with `claude plugin install qsm-c4@qsm-marketplace`.
