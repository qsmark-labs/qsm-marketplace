# Install

```bash
claude plugin install qsm-knowledge@qsm-marketplace
bun plugins/qsm-knowledge/scripts/install.ts
```

Compiles `qsm-knowledge` into `$QSM_BIN_DIR` (default `~/.local/bin`, must be on `PATH`). If `nlm`
is missing it runs `go install github.com/tmc/nlm/cmd/nlm@latest` (needs Go; keep the `cmd/`) and
symlinks it from the Go bin directory. A prebuilt `nlm` already on `PATH` is left alone.
`--dry-run` prints the plan. A link already holding the name that points elsewhere is not replaced
unless you pass `--force`.

Then:

```bash
nlm auth             # reads the session; PrivateNetworkRequestPolicy errors are noise
qsm-knowledge doctor
nlm notebook list    # confirms the session
```

`nlm auth` on Linux reads cookies from the Chrome profile in `~/.config/google-chrome` (and from
Brave and Chrome Canary profiles) and starts the first of `google-chrome`, `chrome` or `chromium`
on `PATH`. When it shows `✗ No notebook.google.com cookies`, sign in once in the Chrome profile,
close the browser, and run `nlm auth` again:

```bash
chromium --user-data-dir=$HOME/.config/google-chrome https://notebook.google.com/
```

Signing in inside the window `nlm auth` opens works too, given the time:
`nlm auth login -keep-open 300`. When queries fail on authentication: `nlm refresh`, then
`nlm auth`.
