## Context

Upstream sentrux (pinned at `f36da08a`) computes quality as the geometric mean of five root causes
(`sentrux-core/src/metrics/root_causes.rs:319`): modularity, acyclicity, depth, equality,
redundancy. Modularity is Newman's directed Q (`root_causes.rs:72`), with a module given by
`core::path_utils::module_of` and the depth in `[modules]`. `compute_health`
(`metrics/mod.rs:563`) calls it with every import and call edge. The layers in
`.sentrux/rules.toml` are read only by the rules engine (`metrics/rules`), which turns an upward
import into a violation; the score never sees them.

Measured on this repository, 2026-10-31, `sentrux 0.5.7-qsm.2 check --json .` in 2.2 s: quality
0.728, modularity 0.704 (Q 0.556), 1244 cross-module edges: 1104 `plugins -> lib`, 123
`lib -> lib`, 14 `.gates -> lib`, 3 `plugins -> plugins`.

## Goals / Non-Goals

**Goals:** a layered architecture scores higher for the shape it declares: slices independent of
each other, every shared dependency pointing down. Configured by the existing `[[layers]]` and
`order`, nothing else. The same in TypeScript, Python and C#.

**Non-Goals:** a new layer syntax; scoring call edges differently from import edges; changing
acyclicity, depth, equality or redundancy; upstreaming the patch.

## Decisions

### D1. Downward edges leave the Q graph

A layer map is built once from `rules.toml`: each file gets the `order` of the first layer whose
`paths` glob matches it, or none. An edge whose source has a higher order than its target is
removed from the edge set Q is computed over (from `m`, from both degree sums and from the
intra-module count). Every other edge stays: same-layer edges between two modules are the cost Q
is for; an upward edge is already a rule violation and also stays a cost; an edge with an
unlayered end stays as today.

Why not credit the edge as intra-module (the rejected option): it would make a plugin that leans
on the core look cohesive, and the owner chose the free form plus a direction term.

### D2. `direction`, the sixth root cause

`direction = downward / cross`, where `cross` is the number of distinct (from, to) file pairs in
different modules, both ends layered, and `downward` those whose source order is higher. 1.0 when
`cross` is 0 or no layer is declared. This is the Stable Dependencies Principle (Robert C. Martin,
Clean Architecture, ch. 14): a dependency points toward the more stable component, and the layer
order is the project's statement of stability. Quality becomes the geometric mean of six terms,
each floored at 0.01 as the five are today.

### D3. One owner for the layer map

The patch adds `sentrux-core/src/metrics/layers.rs` (owned source, copied in by `build-sentrux.ts`
like `cross_module.rs` and `json.rs`). It parses nothing itself: the rules engine already parses
`[[layers]]` into `LayerDef` (`metrics/rules/mod.rs:79`) and assigns each layer its order (`order`,
or the array position when it is absent; lower is more foundational, `rules/mod.rs:190`);
`layers.rs` reuses that assignment and answers `order_of(path)`, so the score and the layer rule can
never disagree about which way is down. `compute_health` gains the layers as an argument, passed by
`check`; a caller without rules passes none and gets today's Q and a direction of 1.0.

### D4. Reporting

`check --json` adds `direction` under `root_causes` with `raw` (downward and cross counts) and
`score`. `lib/structure.ts` adds `direction` to `CAUSES` with the words "imports that point into a
lower layer; a slice importing a sibling slice lowers it". A failing verdict keeps naming each new
cross-module edge; a new upward or sibling edge is what lowers `direction`.

### D5. Build and version

The patch version becomes `0.5.7-qsm.3`. `doctor` and the installer accept only that version, so
a machine with `qsm.2` is told to rebuild. The structure gate goes back into
`.qsm-langdev/gates.json` at pre-commit and pre-push in the same commit that lands the build.

## Risks / Trade-offs

- [C# imports resolve by namespace, not by path] → the dotnet fixture proves an edge from a slice
  into the core is found and counted downward; if it is not, the task stops and reports, no
  workaround.
- [Every quality number moves] → no stored baseline exists; both sides use one binary.
- [The 2 god files sentrux reports (`qsm-langdev/scripts/cli.ts`, `qsm-usage/scripts/cli.ts`,
  fan-out 16)] → a rule violation today, unchanged by this change; the gate compares relative
  quality, so they do not block it. They are findings for their plugins.

## Migration Plan

Build `qsm.3` with install, run `qsm-langdev structure` on this repository against `HEAD~1`, then
turn the gate on. Rollback is the previous commit and a rebuild.
