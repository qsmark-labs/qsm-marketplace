## Why

The structure gate scores a modular kernel, a modular monolith or a vertical-slice architecture
down for its own shape. Patched sentrux computes modularity as Newman's Q over every module, the
core included, so each import of a plugin into the shared core counts as a costly cross-module
edge. Measured on this repository on 2026-10-31: 1104 of 1244 cross-module edges (89 %) are
`plugins -> lib`, and moving shared code into `lib/` lowered quality by 47 against a tolerance of 20
(feedback `qsm-i1u.43`). The gate is switched off in `.qsm-langdev/gates.json` until this lands.
The owner: "can we improve the math or the algorithm so that it benefits this kind of architecture?
Modular kernel / modular monolith / vertical slice", and the layers are set "by the existing layer
order".

## What Changes

- Modularity Q is computed over the edges between siblings only. An edge from a module in a higher
  layer into a module in a lower layer (by `order` in `.sentrux/rules.toml`) leaves the Q graph: it
  is neither charged nor credited there. An edge between two slices of one layer is charged as
  today. An upward edge stays a rule violation and stays in Q.
- A sixth root cause, `direction`, is the share of cross-module edges that point into a lower
  layer (the Stable Dependencies Principle: depend toward what is more stable). A pure kernel or
  pure vertical slices score 1.0; a slice that imports a sibling slice lowers it. With no layers
  declared, or no cross-module edge, it is 1.0.
- Quality is the geometric mean of six root causes, no longer five.
- The patched build reports `direction` in its JSON beside the five others and is versioned
  `0.5.7-qsm.3`; `doctor` and install require that version.
- qsm-langdev names `direction` with words an agent can act on, and turns the `structure` gate back
  on in this repository at pre-commit and pre-push.
- **BREAKING** for stored scores only: every quality number changes with the sixth term. Both sides
  of a comparison are scored by the same binary, so no verdict compares across the change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `qsm-langdev`: the structure requirement gains how a layered architecture is scored, and the
  install requirement names the new build.

## Impact

- `plugins/qsm-langdev/sentrux/wiring.patch` and `sentrux/src/` (a new `layers.rs` for the layer
  map and the direction term), `scripts/build-sentrux.ts` (owned sources), `lib/structure.ts`
  (`CAUSES`), `scripts/cli.ts` (`doctor`'s version check), `.qsm-langdev/gates.json`.
- One cargo build of sentrux on this machine (minutes) and on any machine that runs install.

## Critiques

- Devil's advocate: dropping downward edges from Q could hide a plugin that leans on the core for
  everything. Fixed: such a plugin still shows as fan-out, depth and god-file findings, and the
  direction term only rewards the direction, never the count.
- Devil's advocate: a sixth term in a geometric mean moves every score, so a stored baseline
  would compare wrong. Waived: nothing stores a quality across builds; each comparison scores both
  sides with one binary.
- Future archaeologist: "why is Q not Newman's Q any more?" Fixed: `layers.rs` opens with the
  reason and the owner's words, and the design names the principle with its source.
- Scope sniper: the per-language proof could balloon into a sample project per language. Fixed:
  one small fixture per language (ts, py, dotnet) with a core and two slices, made by the test.
