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

## Risks / Trade-offs

- [Token-only auth for the Pro engine is unverified] → task 1.1 proves it first.
