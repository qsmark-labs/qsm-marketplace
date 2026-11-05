## Why

The structure gate runs a patched sentrux that qsm-langdev builds with cargo on every machine
(minutes), whose score punishes the marketplace's own modular-kernel shape (1104 of 1244
cross-module edges point into `lib/`, measured 2026-10-31), whose layer order is reversed upstream,
and which reports usage to `api.sentrux.dev`; the gate has been off since 2026-10-16. The owner
chose to fork it as `qsm-arch` (its own repository, change `qsm-arch-v1` there), "opinionated for
ME", no GUI, installed as a release binary with a checksum. This change moves qsm-langdev onto it
and turns the structure gate back on (feedback `qsm-i1u.43`).

## What Changes

- **BREAKING** The structural checker is `qsm-arch` (binary and MCP server), pinned to one release
  tag and its sha256. Install downloads that binary into the user's bin directory and checks the
  sum; no cargo build.
- **BREAKING** The rules file is `.qsm-arch/rules.toml`; this repository's `.sentrux/rules.toml`
  moves there. Nothing reads `.sentrux/`.
- Deleted: `plugins/qsm-langdev/sentrux/` (patch and owned Rust sources) and
  `scripts/build-sentrux.ts`.
- `lib/structure.ts` names the sixth root cause, `direction`, with words an agent can act on.
- The `structure` gate is back on in `.qsm-langdev/gates.json` at pre-commit and pre-push.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `qsm-langdev`: the structure requirement (layered score, the new tool), the install requirement
  (download and checksum instead of a build), doctor's structural line.

## Impact

`plugins/qsm-langdev/` (`lib/structure.ts`, `scripts/install.ts`, `scripts/cli.ts`, `.mcp.json`,
`qsm.json`, README, INSTALL, profiles' knip ignore lists, tests), `.sentrux/` to `.qsm-arch/`,
`.qsm-langdev/gates.json`. Blocked by the first `qsm-arch` release.

## Critiques

- Devil's advocate: a download from GitHub is a supply-chain step. Fixed: the tag and the sha256
  are pinned in the plugin; a mismatch fails install loud.
- Devil's advocate: x86_64 Linux only. Waived: one machine; another platform is a new release
  target, not a fallback.
- Future archaeologist: why no `.sentrux/`? Fixed: git holds it; the README says the tool is
  qsm-arch.
- Scope sniper: renaming every mention (112 in the plugin) is churn. Waived: one name per concept;
  half of them are the deleted patch.
