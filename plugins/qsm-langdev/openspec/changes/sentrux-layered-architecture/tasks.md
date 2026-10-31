## 1. The patched sentrux

- [ ] 1.1 `sentrux/src/layers.rs`: the layer map from the rules engine's parsed `[[layers]]`
  (`order_of(path)`), the Q edge filter (D1) and `direction` (D2), with Rust unit tests for a core
  plus two slices: a downward edge leaves Q, a sibling edge stays, an upward edge stays, no layers
  gives today's Q and 1.0. Files: `sentrux/src/layers.rs`, `scripts/build-sentrux.ts`
  (`OWNED_SOURCES`). Proof: `cargo test -p sentrux-core layers` in the patched checkout. Blocked
  by nothing.
- [ ] 1.2 Wiring: `compute_health` takes the layers, `compute_root_cause_scores` takes six terms,
  `check --json` reports `direction`, version `0.5.7-qsm.3`. Files: `sentrux/wiring.patch`,
  `sentrux/src/json.rs`. Proof: `bun plugins/qsm-langdev/scripts/install.ts` builds and installs
  it; `sentrux --version` says `0.5.7-qsm.3`; `sentrux check --json .` on this repository reports
  six root causes, and modularity above 0.704 (before, measured 2026-10-31). Blocked by 1.1.

## 2. qsm-langdev

- [ ] 2.1 `lib/structure.ts` `CAUSES` gains `direction` and its words; `doctor` and install accept
  only `0.5.7-qsm.3`. Files: `lib/structure.ts`, `scripts/cli.ts`, `scripts/install.ts`. Proof:
  `qsm-langdev doctor` names the structural checker ok on this machine after 1.2. Blocked by 1.2.
- [ ] 2.2 One fixture per language (ts, py, dotnet), made by the test: a core layer and two slices.
  Adding a slice -> core import passes `structure` with `direction` not lower; adding a slice ->
  slice import fails it and names the edge. Files: `lib/structure.test.ts`. Proof: the three pairs
  pass with the real `qsm.3` binary. Blocked by 2.1.
- [ ] 2.3 The structure gate back on at pre-commit and pre-push in `.qsm-langdev/gates.json`;
  `qsm-i1u.43` closes with the measured numbers. Files: `.qsm-langdev/gates.json`. Proof: a commit
  and a push of this change pass the gate. Blocked by 2.2.
