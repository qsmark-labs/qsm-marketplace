## Why

The agents and the owner share one GitHub login, so a pull request an agent opened is the owner's
own, and the owner cannot approve it. A second identity that opens the agents' pull requests makes
the owner's approval possible, and the ruleset makes it required.

## What

- **The organization's GitHub App `qsmark-bot`** opens the agents' pull requests, and nothing
  else. `qsm-forge gh pr-open` mints a one-hour installation token from the App key in the vault
  on each call and gives it to the one `gh pr create` child.
- **Everything else stays the owner's**: issues, tasks, comments, replies to review findings,
  pushes and merges are made from the owner's own login.
- **The rulesets of main and `feature/*`** require one approval, dismiss it on a new push, and let
  the owner's admin role bypass only through a pull request, as in ai-guardrails. A merge the
  approval does not cover is the owner's admin merge on the web.

## Decisions of the owner

1. **One App, `qsmark-bot`, for pull requests only**: tasks, issues and replies to findings stay
   the owner's own, because a second identity pays only where an approval needs it.
2. **A local token, no webhook and no Actions**: the token is minted per call on the machine and
   narrowed to one repository and to pull requests, so an error shows in the same command and the
   token cannot do more than open one.
3. **Ghost mode holds**: the bot is deterministic automation, not an AI, and no text it posts
   mentions one.
4. **The owner is the assignee, Macroscope and the owner the reviewers**: `qsmark-bot` assigns the
   owner on every pull request it opens and requests his review, which it can because it is not
   the author.
5. **The admin merge is the owner's, on the web**, because the merge is the owner's acceptance.
