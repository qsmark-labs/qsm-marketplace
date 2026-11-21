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

1. Deterministic. The same input gives the same output: no hidden dependence on time,
   randomness, the environment or iteration order unless an input names it.
2. A test proves the intended use or a real edge case through the real path. A fixture is
   recorded from the real producer, never written from what the consumer expects.
3. Clean before and after. A run leaves no temp files, and nothing deletes what the person made.
   Whatever starts a process, a timer or a server waits for its end or hands back its handle; a
   test that waits on a log line, a file or a sleep instead of that end is a break.
4. Nothing a UI paints touches anything else. Every gap comes from the spacing scale.
5. The repositories are public: no secrets, employer names, machine paths or AI attribution.

## When no rule applies

Ask which input this change accepts that nobody said was valid, and which failure it lets pass
quietly: either one is a finding. Then read it as a stranger who must fix it next year: code they
cannot follow without asking the author, or a moving part the case does not need, is a finding.
