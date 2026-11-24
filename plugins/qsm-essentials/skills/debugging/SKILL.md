---
name: debugging
description: "Use when something is broken and you do not yet know why: a bug, a failing test, behaviour nobody expected, a test that fails only sometimes, or code that worked before. Triggers: bug, test failure, unexpected behaviour, flaky, it worked before, root cause, why does this fail, proc to pada. Not for restructuring working code (refactoring)."
---

# Debugging

A fix made before the cause is known is a guess, and a guess that turns the check green hides the
fault. Reproduce, find the cause, make the one fix for it.

## Rules

- Reproduce it first, as one command you can rerun, and run it yourself before any edit. Without
  it you fix the bug you imagined and cannot tell when you are done. Cannot reproduce: say so and
  name what you need.
- The same command is the proof after the fix. A different command is a different test, so a green
  result from it says nothing about this bug.
- Trace backwards from the bad value to the first place it was right and left wrong. With several
  hops between symptom and origin, halve the path: look at the value at the middle hop, and the
  half that is already wrong holds the cause. Fix there. A null check or try block at the symptom
  leaves every other caller broken. Find callers with the code index's impact query (the query
  that lists what depends on a symbol) before the edit.
- A fallback on the path (`|| 0`, `?? ""`, an empty catch, a default) is where the trail goes
  quiet, because it turns a wrong input into a plausible output. Make it throw for the run and the
  first wrong value names itself. Whether it stays is a decision after the cause is known.
- Change one variable per run, because two changes and one result prove nothing.
- Name the cause in one sentence with a "because", and prove it by changing the one input it names:
  the symptom must move. Drop a wrong hypothesis, never stack a second guess on it.
- Something that looks wrong but does not move the symptom when changed is ruled out. Report it,
  do not fix it, because a fix for it is a second change nobody asked for.
- A flaky failure gets a rate: run the command in a loop (20 runs) and diff one pass against one
  fail (order, timing, leftover state, machine). Retry, skip and weaken are never the fix.
- It worked before: `git bisect run <the reproduction>` between the last good commit and now.
  A handful of runs finds the commit however large the range.
- Budget three hypotheses. When it runs out, stop and report what you ruled out and what you
  would need. When three fixes in a row each expose a new problem, stop: it is a design problem.
- Fix with one change for the cause and nothing "while I am here", because a reviewer cannot
  separate a fix from a refactor. Rerun the reproduction, then the project's tests once.
- Remove your instrumentation. Record the cause in the commit message. A defect you found
  elsewhere is one line at the end, not part of this fix.

## Red flags

- When you are about to edit and have not seen the failure yourself, reproduce it, because the
  fix targets an imagined bug.
- When the symptom went quiet after a guard or a retry, find what produced the bad value, because
  the guard only moved the failure.
- When the check is green and you cannot name the causing line, keep going, because the cause is
  still in the code.
- When the diff touches more than the line the cause names, split the rest out, because it is not
  the fix.

## Say it in the reply

The cause in one sentence with its "because", the command that reproduces it, and what the same
command showed after the fix. When the cause is not proved, say what is known, what is only
suspected and what you need.
