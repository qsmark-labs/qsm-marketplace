## Why

The `ci` point is in the point table and every language declares checkers at it, but nothing runs
it: CI has no `langdev` job, `check` does not take `--at ci`, and semgrep's Pro form needs
`SEMGREP_APP_TOKEN`, which the owner adds later. These lines were part of
`langdev-point-targets`; they moved here on 2026-10-31 so that change could archive with a main spec
that describes only what runs.

## What Changes

- `check --at ci` runs the `ci` set; every semgrep checker there is `semgrep scan --pro` over the
  whole tree, logged in by `SEMGREP_APP_TOKEN`, failing loud without it; nothing runs `semgrep ci`.
- `.github/workflows/ci.yml` gains the `langdev` job on every push to `main`, `timeout-minutes: 30`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `qsm-langdev`: the CI job requirement, and semgrep's `ci` form.

## Impact

Archive order: `langdev-point-targets` first, because this change's MODIFIED semgrep requirement is
written against the text that change archives.

`plugins/qsm-langdev/lib/registry.ts` (semgrep's ci args), `scripts/cli.ts` (`--at ci`),
`.github/workflows/ci.yml`, the repository secret `SEMGREP_APP_TOKEN`.

## Critiques

- Devil's advocate: a CI job that fails without a secret is red until the owner acts. Fixed: the
  job lands only after the token exists (task 1.3).
- Scope sniper: nothing beyond what moved from `langdev-point-targets`.
