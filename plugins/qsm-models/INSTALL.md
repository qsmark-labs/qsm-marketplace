# Install

```bash
bun plugins/qsm-models/scripts/install.ts
```

Needs `bun`. The installer runs `bun install --frozen-lockfile` in the plugin, compiles
`qsm-models` into `QSM_BIN_DIR` (default `~/.local/bin`) and writes its completion. `--dry-run`
prints the plan. bpmnlint, bpmn-js, bpmn-auto-layout, elkjs, jsdom and LikeC4 are compiled into the
binary, so it needs no program on PATH, no browser and no Graphviz. The plug-in itself installs
with `claude plugin install qsm-models@qsm-marketplace`.
