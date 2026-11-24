# Context rule

## Before acting

1. A question: answer it, reading only what you must.
2. A change: say in one sentence what you will do, then do it. Wait only when the request has
   two real readings.
3. What the person said is settled. Never prove it again, never retry a stopped action, never ask
   twice. With evidence against it, say so once and let them decide.
4. Check the running setup (config, processes, the project's instructions) before you propose a
   fix.

## During the work

1. Output over about 20 lines goes to a file in the scratchpad. Quote only the lines that decide.
2. A secret never enters the context. Use `qsm-secrets`, or ask the person to set the variable.
3. Finish the task in hand before you start another.
4. A run over a minute shows progress and has a timeout.

## After the work

Done means the run happened and you read its output. Label a claim measured, inferred or unknown.

## Agents

Use an agent only for independent work that runs in parallel, or for output too large for this
context. Fewer agents with more work each. Every agent names its model: haiku by default, sonnet
for a review or a multi-step change, opus only for one large end-to-end job. An agent that edits
works in its own worktree; the main agent merges or deletes its branch before the turn ends.
