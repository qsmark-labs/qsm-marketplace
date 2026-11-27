# How we review

## Mindset

- Whitelist code. Every input and every output is wrong, and fails, until an implemented path
  says it is right.
- Fail loud, fail early. A stop at the cause is better than a pass that hides it.
- One path. No fallback, and no code branch that lets a case through by default.
- The best code is the code not written. Every new file, option or test claims something is
  missing; check that the claim holds.
- One owner per concept, so a fix lands in one place.

## Implementation rules: report every break

1. Unified errors. A project has one typed error system: a stable code, a message a person can
   act on, the data to act. No ad-hoc string, no bare throw, no swallowed error.
2. Inputs are validated where they enter, against an explicit shape. An unknown field, value or
   shape is refused. A switch over a closed set names every case, and its default throws.
3. No fallback: no second way, no default that hides a missing value (`?? ""`, `|| []` on
   required data), no catch that carries on.
4. No backward compatibility and no history in the code: no deprecated markers, `v2` copies,
   renamed-from notes or dates. Git holds the history.
5. Functional and modular. A decision is a pure function, side effects live at the edges, and
   each module has one job.

## Correctness rules: report every break

0. Cleanup, forward and backward, blocks approval. Report every path where a run that ends, fails
   or times out can leave a process, temp file, lock, pid file or socket: a spawn whose children
   outlive a timeout, a detached process with no stop, a test that starts a daemon and never ends
   it. Report every tool that starts without removing what a crashed earlier run of itself left.
   A process a tool starts carries `QSM_OWNER`, and `lib/reap.ts` ends it at both points. Each of
   these is a break too:
   - A cleanup removes more than its tool made: a directory another program wrote into keeps
     what that program wrote, and only the tool's own copies and links go.
   - A cleanup can kill what another run or the person shares: a server reused across runs (a
     build server, a language server) runs with reuse off or outside the tool's mark.
   - Two runs clean the same leftover and one fails: one claims it atomically (a rename), and the
     other finds it gone and goes on.
   - A sweep's cost grows with history: what it keeps leaves its reach, and it scans once per
     sweep, not once per entry.
   - A time limit is shorter than the callee's own, so it cuts a healthy call.
   - A child that must carry a mark gets it from a mutated `process.env` under Bun: `Bun.spawn`
     reads the environment of the process start, so the env is passed explicitly.
1. Deterministic. The same input gives the same output: no hidden dependence on time,
   randomness, the environment or iteration order unless an input names it.
2. A test proves the intended use or a real edge case through the real path. A fixture is
   recorded from the real producer, never written from what the consumer expects. Each of these
   is a break too:
   - A test of a fix passes without the fix.
   - A fixture ends what it starts in its own `afterEach`, which binds to the first test file
     only; it registers the end with the run's per-test hook (`atTestEnd`).
   - The test harness changes what the code under test sees: a guard that keeps a killed process
     a zombie makes `kill(pid, 0)` call it alive.
3. Clean before and after. Nothing deletes what the person made. Whatever starts a process, a
   timer or a server waits for its end or hands back its handle; a test that waits on a log line,
   a file or a sleep instead of that end is a break.
4. Nothing a UI paints touches anything else. Every gap comes from the spacing scale.
5. The repositories are public: no secrets, employer names, machine paths or AI attribution.

## When no rule applies

Ask which input this change accepts that nobody said was valid, and which failure it lets pass
quietly: either one is a finding. Then read it as a stranger who must fix it next year: code they
cannot follow without asking the author, or a moving part the case does not need, is a finding.
