Stub: Why, What, open decisions and one anchor requirement only. Planned when the owner asks;
models, specs and design come at its planning.

## Why

The agents and the owner share one GitHub login, so a review by the review agent, a pull request
by the implementation agent and the owner's approval all look the same, and "the owner merges"
is a rule in a skill, not a gate GitHub enforces. A second identity makes the owner's yes visible
and enforceable.

## What

- **A GitHub App of the organization** opens the agents' pull requests and posts the review
  agent's reviews, so each shows who wrote it.
- **Branch protection** on main and on `feature/*` requires the owner's approval, which the App
  cannot give.
- **`qsm-tasks` and `qsm-forge`** take the App's token for agent writes; the owner's own actions
  stay his.

## Decisions of the owner

1. **Now, with `qsm-tasks-cli`** (2026-11-06): the App is built with the binary, so every agent
   write goes through it from the first day and nothing is rewired later.
2. **One App, `qsmark-bot`** (2026-11-06): "je to proste qsmark-bot, a pres nej se automaticky
   budou zakladat PRs". It opens every agent pull request and issue.
3. **Ghost mode holds** (2026-11-06): the bot is automation, not an AI: "to je bot ne AI, to je
   automatic static, deterministic code". Its name is the only trace; no text it posts mentions
   an AI.
