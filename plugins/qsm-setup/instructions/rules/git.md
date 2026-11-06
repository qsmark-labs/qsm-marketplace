# Git rule

Read this when you commit, merge, push, or answer a review. The commit message form
is the writing skill; worktrees are the worktrunk skill; threads are the review-threads skill.

1. Every session works in its own worktree under the project's `.claude/worktrees/`, made through wt
   (`EnterWorktree`), never in the main checkout, which only follows main; a subagent's worktree is
   cut from its session's branch. So every gate judges only the tree its own agent works in: the
   edit the edited file in place against its rules, with no tree and no branch; the commit and the
   stop what is staged against the worktree's HEAD; the push the pushed commit against the code it
   lands on, the branch's latest remote work (main's when it is main, the commit it was cut from
   when the branch is new), while the marketplace gates judge the commit itself. Every comparison is
   against the code it adds onto, so the work never degrades, and takes staged and committed content
   only, never an unstaged change, so a file another session left behind never blocks it. Merge,
   never rebase unless it is needed. The person in their words: "kazda session si udela svuj
   worktree pod .claude/ of the project", "there should be no shared checkout ever", "Unstaged
   nebereme nikdy a nikde. Staged and up".
2. The main agent pushes when a task or a batch finishes, so local commits never pile up. A worker
   never pushes.
3. Work lands in this order: a worktree, a local test, `/simplify`, a local review agent, then the
   landing. A step skipped is named, never silent. Where main requires a pull request, the landing
   is a pull request that links its issue (`Closes #<n>`), which the person merges; the owner's
   bypass is the person's, and an agent uses it only for the task tool's own commits. Elsewhere
   the landing is a merge to main and its push.
4. `/simplify` runs before the review, and the review reads the code that will land, because
   `/simplify` can drop code that handles an edge case it did not recognise and only a review
   after it catches that. Fix every review finding that holds, nitpicks included, before you push,
   because a second round trip costs more than a one-line fix; a fix that changes more than the
   finding's lines gets the reviewer back on that fix. The person in their words: "spis napred
   simplify a potom review".
5. A merge or push runs only after the commit it carries succeeded: never chain them after a
   commit in one command, because a gate that blocks the commit leaves the merge carrying the
   tree without it.
6. Ask `gh` for `--json` when the output is read by a program. Read fresh comments with
   `gh api repos/<owner>/<repo>/issues/<n>/comments`, because `gh issue list --json comments` lags
   behind.
