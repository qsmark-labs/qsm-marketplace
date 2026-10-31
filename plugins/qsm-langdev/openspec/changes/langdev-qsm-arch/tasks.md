## 1. qsm-langdev on qsm-arch

Blocked by the first `qsm-arch` release (repository qsm-arch, change `qsm-arch-v1`).

- [ ] 1.1 Install downloads the pinned release and checks its sha256 (D1); `build-sentrux.ts` and
  `sentrux/` are deleted. Files: `scripts/install.ts`, its test, `lib/paths.ts` use. Proof: the
  three install scenarios as tests with a local file server; a real install on this machine reports
  `installed`, then `already`.
- [ ] 1.2 One name (D2): `lib/structure.ts`, `.mcp.json`, `scripts/cli.ts` (doctor), `qsm.json`,
  README, INSTALL, the knip ignore lists, tests; `.sentrux/rules.toml` moves to
  `.qsm-arch/rules.toml`. Proof: `git grep -i sentrux -- plugins/qsm-langdev ':!*/openspec/*'`
  empty; `qsm-langdev doctor` names the structural checker ok.
- [ ] 1.3 `direction` in `CAUSES` (D3); a fixture per language (ts, py, dotnet): slice to core
  passes, slice to slice fails naming the edge. Files: `lib/structure.ts`, `lib/structure.test.ts`.
  Proof: the tests with the real binary.
- [ ] 1.4 The structure gate on at pre-commit and pre-push; `qsm-i1u.43` closes with the measured
  quality before and after. Files: `.qsm-langdev/gates.json`. Proof: a commit and a push pass it.
