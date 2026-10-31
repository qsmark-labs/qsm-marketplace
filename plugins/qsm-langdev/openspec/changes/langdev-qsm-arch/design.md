## Context

`qsm-arch` (repository `Questi0nM4rk/qsm-arch`, change `qsm-arch-v1`) is the fork of sentrux v0.5.7
with the layered score (downward edges leave modularity Q, a sixth root cause `direction`), no GUI,
no Pro tier, no network, `exclude_globs` and `max_fan_out`. qsm-langdev today: `lib/structure.ts`
runs `sentrux check --json`; `scripts/install.ts` builds the patch with `build-sentrux.ts`;
`.mcp.json` starts `sentrux mcp`; `doctor` checks for a `qsm` version string.

## Goals / Non-Goals

**Goals:** one structural checker, installed in seconds, pinned and verified; the structure gate on.

**Non-Goals:** the scoring itself (it lives in qsm-arch); other platforms.

## Decisions

### D1. Pin and verify

`scripts/install.ts` holds `QSM_ARCH_TAG` and `QSM_ARCH_SHA256`. Install is `already` when
`qsm-arch --version` reports the tag's version; otherwise it downloads
`https://github.com/Questi0nM4rk/qsm-arch/releases/download/<tag>/qsm-arch-x86_64-linux`, checks the
sha256, installs it executable into the bin directory `lib/paths.ts` names, and reports
`installed`; a sum mismatch or a failed download is `error` naming the URL; a dry run names the URL
and downloads nothing.

### D2. One name

Every call, message, MCP server name and test says `qsm-arch`; the rules path is
`.qsm-arch/rules.toml`. `doctor` reports the structural checker ok only at the pinned version.

### D3. The sixth cause

`CAUSES` in `lib/structure.ts` gains `direction`: "imports that point into a lower layer; an import
into a sibling slice or an upward import lowers it".

## Risks / Trade-offs

- [The release does not exist yet] → this change is blocked by qsm-arch's first tag.
- [GitHub unreachable at install] → install fails loud naming the URL; no fallback build.
