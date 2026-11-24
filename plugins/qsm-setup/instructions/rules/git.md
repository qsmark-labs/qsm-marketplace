# Git rule

1. Each session works in its own worktree under `.claude/worktrees/`, made with wt
   (`EnterWorktree`), never in the main checkout.
2. Merge, never rebase unless needed. Never chain a merge or push after a commit in one command.
3. Where main requires a pull request, open one that says `Closes #<n>`. Where the organization
   has a bot App, open it as the bot (`qsm-forge gh pr-open`). The person is the assignee and
   merges it.
4. A task that builds on an unmerged task is a stacked pull request on that task's branch.
5. Before the push: the project's own lint, typecheck and tests. A blocked commit means fix the
   cause, never bypass the gate.
6. Ask `gh` for `--json` when a program reads the output.
