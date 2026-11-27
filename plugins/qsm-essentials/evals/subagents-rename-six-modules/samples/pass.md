Approach: six independent writers, so I delegate. Each gets its own worktree and branch. Flow: 1.
Decide: billing keeps a Clock alias, and put that in billing's task. 2. Dispatch five workers in
their own worktrees; audit goes first, mail after it. 3. When audit says complete I run bun test
audit in its worktree and read the diff. Next step: dispatch.
