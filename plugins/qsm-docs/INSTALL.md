# Install

```bash
bun plugins/qsm-docs/scripts/install.ts
```

Needs `bun`. The installer compiles `qsm-docs` into `QSM_BIN_DIR` (default `~/.local/bin`) and
writes its completion; `--dry-run` prints the plan. At run time the binary needs only `git` on
PATH: the page shell and the `json` kind's page are compiled into it. The plug-in itself, with its
hooks, installs with `claude plugin install qsm-docs@qsm-marketplace`.

A plugin that brings a kind runs `qsm-docs kind remove <name>` and then `qsm-docs kind add
<manifest>` from its own installer, so an older copy of its page files never stays behind.
