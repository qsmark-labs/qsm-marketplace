## 1. The ci point

Blocked by `SEMGREP_APP_TOKEN` in the repository's secrets (the owner adds it).

- [ ] 1.1 Verify that `semgrep scan --pro` with only `SEMGREP_APP_TOKEN` set runs the Pro engine and
      uploads nothing (design D7 says unverified). Proof: one local run with the token from
      `qsm-secrets`, its output and the semgrep docs page quoted in `measurements.md`. Blocked by
      nothing.
- [ ] 1.2 The `ci` point: semgrep's `ci` form is `scan --pro` over the whole tree, a missing token
  fails naming it; `check --at ci` accepted. Files: `lib/registry.ts`, `lib/compare.ts`. Proof:
  `qsm-langdev check --at ci --against HEAD~1` locally, once with and once without the token.
  Blocked by 1.2 and 5.2.
- [ ] 1.3 The `langdev` job in `.github/workflows/ci.yml` (spec: CI runs the ci point). Proof: the
  job green on a push to `main`, its log showing the `ci` comparison; the owner adds the
  `SEMGREP_APP_TOKEN` secret first. Blocked by 5.1 and 5.3.
