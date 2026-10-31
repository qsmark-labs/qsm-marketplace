## 0. Close langdev-point-targets first (finding 1, 18)

- [x] 0.1 Task 4.1 of `langdev-point-targets`: assert `profileGaps()` empty in
  `lib/profiles.test.ts` and `registryGaps()` empty in `lib/registry.test.ts`, with the negative
  case 4.1 names (a language without a checker at `edit`); both leave `doctor`. Files:
  `lib/profiles.test.ts`, `lib/registry.test.ts`, `scripts/cli.ts`. Proof: those two test files
  green, and a registry copy without dotnet's edit checker fails the test. Blocked by nothing.
- [ ] 0.2 Move tasks 5.2 to 5.4 and the CI-job requirement of `langdev-point-targets` into a new
  change `langdev-ci-point`, waiting for `SEMGREP_APP_TOKEN`; 6.1 (docs) is done by 4.3 below and
  6.2 re-measures; then archive `langdev-point-targets`. Files: both changes' directories, the main
  spec. Proof: `openspec validate --strict` on both; `grep -n "working tree holds"
  openspec/specs/qsm-langdev/spec.md` empty. Blocked by 0.1 and 4.3.

## 1. Batch A: verdicts, sides and one judge (5, 6, 16, 9, 3, 17, 14 partly)

- [x] 1.1 `Verdict` and `Score` failure as unions on `kind`; every reader one switch. Files:
  `lib/compare.ts`, `lib/result-store.ts`, `lib/gate-runner.ts`, `hooks/gate-hook.ts`,
  `scripts/cli.ts`, `scripts/cli-judge.ts`, tests. Proof: a test building `{pass: true, missing:
  true}` carries `@ts-expect-error`; `bun run typecheck`; the qsm-langdev suite green.
- [x] 1.2 Tree sides typed `{kind: "index"} | {kind: "commit"; sha: Sha}`, `Sha` branded by
  `resolveRef`. Files: `lib/compare.ts`, `lib/structure.ts`, `lib/gitref.ts`, `lib/state.ts`,
  `lib/gate-runner.ts`, `hooks/gate-hook.ts`, `scripts/cli.ts`. Proof: `grep -rn '=== "index"'
  lib` empty; typecheck. Blocked by 1.1.
- [x] 1.3 The first commit is reported, not blocked. Files: `lib/gate-runner.ts`,
  `lib/gate-runner.test.ts`. Proof: scenario "The first commit with a finding" as a test in a fresh
  repo through the real hook.
- [x] 1.4 One judge with the policy table of D1; one `describeVerdicts`. Files:
  `lib/gate-runner.ts`, `hooks/gate-hook.ts`, tests. Proof: the two scenarios of "one rule" as
  tests; the existing gate-hook and gate-runner tests pass unchanged. Blocked by 1.1.
- [x] 1.5 The stop gate names untracked files. Files: `hooks/gate-hook.ts`, its test. Proof: a new
  untracked file at a stop gives `untracked, not scored: <file>` and no block.

## 2. Batch B: one process runner and one git helper (2, 11, 10, 20)

- [ ] 2.1 `lib/process.ts` owns the runner; sentrux, gitleaks, detect-secrets, fixers, rumdl,
  probes, the pack fetch and the login probe go through it with the point's limit; the private
  limits go. Files: `lib/process.ts`, `lib/compare.ts`, `lib/structure.ts`, `lib/gate-runner.ts`,
  `lib/fixers.ts`, `lib/markdown-wrap.ts`, `lib/rule-packs.ts`, `lib/semgrep-login.ts`, tests.
  Proof: scenario "The structural checker hangs" with a fake sentrux that sleeps and a 200 ms
  limit, no child left (`pgrep`). Blocked by batch A.
- [ ] 2.2 Prove which index `git commit <paths>` scores, as a test; then one `git(root, args)` in
  `lib/gitref.ts` with that one env policy, `state.ts`'s copy of `resolveRef` gone. Files:
  `lib/gitref.ts`, `lib/config.ts`, `lib/tree.ts`, `lib/state.ts`, `lib/push.ts`,
  `lib/structure.ts`, `lib/git-hooks.ts`, `lib/gate-runner.ts`. Proof: the test; suite green.
  Blocked by 2.1.
- [ ] 2.3 Measure, then decide: one run-wide `JOBS` limiter (10), and `gitIndexInto` only for
  structure (20). Proof: `check` timed before and after on this repository with load named; lands
  only with a gain of at least 1 s, else the line closes with the numbers. Blocked by 2.2.

## 3. Batch C: config, registry and less code (4, 7, 8, 14, 15, 19, 24)

- [x] 3.1 Delete the import graph and `changed+N` (D6). Proof: `grep -rn
  "changedPlus\|import-graph\|noExtractor" plugins/qsm-langdev` empty; suite green.
- [x] 3.2 Gates config fails loud; `GateName` and `HookPoint` types (D4, D5). Files:
  `lib/config.ts`, `lib/gate-runner.ts`, `lib/registry.ts`, `lib/git-hooks.ts`, tests. Proof: the
  two scenarios of "fails loud" as tests.
- [x] 3.3 bandit needs `bandit.yaml`: a per-checker missing config. Files: `lib/registry.ts`,
  `lib/compare.ts`, a test. Proof: scenario "A checker's own config is missing".
- [x] 3.4 Dead plumbing out: `Judged.failedRun`, `module`, `Install.prereq` and `pms`, the second
  `hasNoExtension`, `StructureTree`, `compareIndexSince`. Proof: typecheck, lint, validate green.
- [x] 3.5 Hooks shell only; `install --lang` goes from `qsm.json` and the noun. Files:
  `lib/git-hooks.ts`, its test, `scripts/cli.ts`, `qsm.json`. Proof: an existing python hook is
  named with the line to add; `bun run validate`.

## 4. Batch D and E: stop hook, docs, evals (21, 12, 13, 23)

- [ ] 4.1 A classic `Stop` entry in `hooks/hooks.json`; the comments in `register.tsx` and
  `gate-hook.ts`. Proof: scenario "The main agent stops with a worse staged tree" as a test with
  no `agent_id`; `claude plugin validate`; then in a real session a staged regression blocks the
  main agent's stop once.
- [ ] 4.2 `doctor`'s language line says what the code does. Files: `scripts/cli.ts`, its test.
- [ ] 4.3 README, USAGE, INSTALL, `qsm.json` and comments say what the code does: the four
  points, targets, `slow:`, doctor's median, staged only, edit in place, the real install command,
  the test seam named as a test seam. Proof: `grep -rn "against HEAD\|55000\|working tree"
  plugins/qsm-langdev --include=*.md` shows no stale line; `bun run validate`.
- [ ] 4.4 One generated negative eval per language plugin; the six copies go. Files:
  `.gates/plugin-eval.ts`, `plugins/qsm-langdev-*/evals/unrelated-negative/`. Proof: `bun run eval
  qsm-langdev-ts` still reports the negative case.
