# Implementation rule

1. Reuse first. Search the code you are in, its dependencies and the platform for the thing
   before you write it. Extending something that exists beats a new file, a new module or a new
   tool every time.
2. The smallest change that works. Follow the pattern of the code around you. Add no layer, no
   abstraction and no option the task does not need now.
3. One path. No fallback, no compatibility branch, no history in the code. When the path fails,
   fail loud with the project's own error and name the cause.
4. Validate input where it enters. Refuse what no path names instead of passing it on.
5. A test only when it proves the real flow or a real edge case, and only when the task asks for
   one or the change cannot be checked otherwise. Never a test that restates what you just wrote.
6. UI work is checked on the real surface: a screenshot, a recording or measured geometry.
7. Leave the machine as you found it, forward and backward. When a run ends, by success, failure
   or timeout, every process it started and every temporary file, lock and socket it made is gone,
   the children of its children included. On start, a tool removes what a crashed earlier run of
   itself left, and names each removal. In qsm, every started process carries the owner mark
   `QSM_OWNER` and `lib/reap.ts` finds them. A daemon meant to outlive the call has a stop verb.
   A test that leaves a process running fails by name.
8. Never delete what the person made: no retention period and no `cleanupPeriodDays` below 36500.
