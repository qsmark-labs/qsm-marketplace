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

## Open decisions

1. **Now or after the flow has run on a few features?** Recommended after: the flow is proved
   first with one login, then the gate is added.
2. **One App for all agents, or one per role** (implementation, review, QA)? Recommended one, with
   the role in the pull request or review body, because each App is a key to keep secret.
3. **Ghost mode**: a bot identity names an agent on every pull request, against "no mention of an
   AI anywhere it is posted"; the owner allowed `from:` labels on feedback. Does that extend here?
