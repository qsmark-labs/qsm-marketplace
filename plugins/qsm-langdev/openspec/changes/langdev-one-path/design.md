## Context

The review and its verification are in the session scratchpad of 2026-10-31
(`fable-langdev-review.md`, `fable-verified.md`); each decision below names its finding number.
Owner decisions that bound it: staged and committed content only; the edit hook checks the edited
file in place; a push compares against the code it lands on; every language keeps a checker at
`ci`, so `ci` stays in `Point` and only the CI job waits for the token.

## Goals / Non-Goals

**Goals:** one owner per concept, one path that fails loud, types that make a wrong state not
compile, docs that say what the code does. No behaviour lost that a spec scenario names.

**Non-Goals:** the CI job (moved to `langdev-ci-point`); the sentrux change
(`sentrux-layered-architecture`); new checkers.

## Decisions

### D1. One judge (3, 5, 16)

`Verdict` becomes a union on `kind`: `measured` (with `pass`), `skipped`, `missing-binary`,
`missing-config`, `not-measured`. `Score`'s failure side becomes `{ kind: "timed-out" |
"failed-run" | "missing"; reason }`. `lib/gate-runner.ts` owns one `judge(root, before, point)`
that returns gate outcomes, and one `describeVerdicts`. The policy is one switch:

| Verdict kind | Commit and push gate | Stop gate |
| --- | --- | --- |
| measured, worse | block (`worse`) | block |
| missing-binary, missing-config | block | warn |
| not-measured | block (`blocked`: nothing proved the tree no worse) | warn |
| skipped | report | report |

### D2. One process runner (2)

`spawnAsync` moves from `compare.ts` to a new `lib/process.ts` and is the only way a run starts a
process: its own group, killed on the limit. Every caller passes its point's `timeoutMs`; the edit
point passes what is left of its deadline. `rule-packs.ts` fetches with an `AbortSignal` of the same
value. The callers that were synchronous become async. git plumbing stays synchronous in
`lib/gitref.ts`, bounded by the same timeout through `spawnSync`'s own limit; the presence and login
probes keep the owner's one timeout of five minutes ("chci aby to melo 5MIN timeout"), never a
shorter private one.

### D3. One git helper (11, 14)

`lib/gitref.ts` owns `git(root, args)` with one environment policy and `resolveRef`; `state.ts`
drops its copy. Which index a hook-time run reads is decided by a test of `git commit <paths>`
(task 3.2) before the policy is fixed.

### D4. Types at the boundaries (6, 15)

A tree side is `{ kind: "index" } | { kind: "commit"; sha: Sha }`, `Sha` branded by `resolveRef`.
One point family: `Point`, `ComparedPoint = Exclude<Point, "edit">`, `HookPoint =
Exclude<ComparedPoint, "ci">`, and `HookName` is `HookPoint`. `GateName` comes from `KNOWN_GATES`;
`GatesConfig.hooks` is `Record<HookPoint, GateName[]>`, checked when read.

### D5. Fail loud at read (7, 8, 9)

`readGatesConfig` throws the project's `failed` error naming the file and the field on bad JSON, a
non-object, an unknown language or gate; an absent file stays the default. A checker that names a
config file of its own (bandit's `bandit.yaml`) is `missing-config` when it is absent. The commit
gate passes `hasReference = before !== null`, as `check` does.

### D6. Less code (4, 14, 19, 23, 24)

Delete the import graph (`import-graph.ts`, `imports-ts.ts`, `imports-py.ts`, `extractor.ts`, its
test, the `{ changedPlus }` arm of `FileSet`, `.qsm-langdev/graph/`). Delete `Judged.failedRun`,
`LANGUAGE_TABLE[*].module`, `Install.prereq` and `pms` (`Install` becomes a string), the second
`hasNoExtension`, `StructureTree`, `compareIndexSince`. Hooks are shell only. The eval gate runs one
generated negative case per plugin with a `*-dev` skill.

### D7. The main agent's stop (21, 17)

`hooks/hooks.json` gains a classic `Stop` entry with the gate's command and `timeout: 600`. No gate
code changes: `editorOf` already maps a missing `agent_id` to the main agent, the output is already
the classic block, and the cap is keyed per session and agent. The stop gate's warning names
untracked files (`git ls-files --others --exclude-standard`) beside unstaged changes.

### D8. Measure first (10, 20)

One run-wide limiter of `JOBS` (10) and `gitIndexInto` only for structure (20) land only when a
timed `check` before and after on this repository shows a gain of at least one second; otherwise
the line closes with the numbers and no code.

## Risks / Trade-offs

- [Async process runner ripples through callers] → done first in its batch, with the suite green
  before the next line.
- [A `Stop` block in a main session spends that session's cap] → the cap is the existing three
  blocks; the fourth stop passes with a halt record, as for subagents.
- [Stored scores in the old `Score` form] → the stored form's version is bumped; an old entry is a
  miss.

## Migration Plan

`langdev-point-targets` archives first (tasks 0.x), then batches A to E land in order, each through
review and the integration gate. Rollback is a revert of the batch's merge.
