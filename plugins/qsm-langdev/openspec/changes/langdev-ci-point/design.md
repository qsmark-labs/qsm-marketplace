## Context

Moved from `langdev-point-targets` (its design D4 and D5 hold the measurements: the Pro engine over
the whole tree took 128 s quiet, 373 s with every core busy, past 600 s at load 15).

## Goals / Non-Goals

**Goals:** the `ci` point runs on every push to main with the Pro engine.
**Non-Goals:** any change to the other three points.

## Decisions

### D1. Token, never upload

`semgrep scan --pro` with `SEMGREP_APP_TOKEN` in the environment; never `semgrep ci`, which
uploads findings. A missing token fails the checker naming the variable.

### D2. The job lands after the token

Task 1.3 waits for the secret, so `main` never carries a job that cannot pass.

### D3. CI runs the `ci` point as its own job

A `langdev` job in `.github/workflows/ci.yml`, next to the existing one, on a push to `main`:

1. installs the checkers `qsm-langdev doctor` names and builds the bin;
2. runs `qsm-langdev check --at ci --against ${{ github.event.before }}`; an all-zero or unknown
   `before` is skipped with its reason, as the push gate skips a first push;
3. has `timeout-minutes: 30`.

At `ci`, semgrep runs `semgrep scan --pro` over the whole tree with `SEMGREP_APP_TOKEN` from a repo
secret, and never `semgrep ci`, which uploads. A missing token fails the job naming the secret: one
path, no community fallback. That `scan --pro` with only the token neither uploads nor needs
`semgrep login` is unverified; task 1.1 checks it first.

## Risks / Trade-offs

- [Token-only auth for the Pro engine is unverified] → task 1.1 proves it first.
