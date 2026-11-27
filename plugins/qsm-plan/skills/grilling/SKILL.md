---
name: grilling
description: "Use when the person asks to be grilled or interviewed, or when a plan, design, or idea they want planned still carries decisions only they can settle, or when they ask for a business request to become an epic with its intent and acceptance criteria. Triggers: grill me on this, ask me what you need, interview me about this, what is still undecided, zeptej se me, settle these decisions, write the epic. Asks only what the agent cannot decide, in one batch, each question with a recommendation, and writes the epic after the person's yes. Never a gate in front of a plain request. Not sizing an ask (plan), and not writing the spec."
---

# Grilling

A plan with an unsettled decision ships that decision as a guess. This skill asks the person only
what only they can answer, in as few round trips as possible, with the analysis already done so
they confirm or correct. It works at the level of what the work does and how it behaves, not where
code goes. It runs only when the person asked to be grilled, or asked for an epic; a plain request
is done, not interviewed. It does not size the ask or write the spec.

## Gather, reason, then ask

1. **Gather** what already answers the ask: the project's `AGENTS.md` or `CLAUDE.md`, the specs,
   the tasks, memory, the code. A rule written there is decided.
2. **Reason**: write your own answer to each open point and decide what the evidence decides.
3. **Ask** only what neither settled. A question whose answer you could pick yourself, or whose
   wrong pick costs less than a turn, is not asked: pick it and say so in one line.

## Rounds

- **One round is the whole frontier**: every open question whose prerequisites are settled, sent
  together. A question that depends on an open one waits for the round that settles its parent.
- **Every question carries a recommendation**, so the person confirms in one word or corrects. When
  a trade-off is the question, say what each side costs.
- **Facts are fetched, decisions are asked.** What the code, the specs, memory or the task tool
  answers is not a question. What was settled this session or by the project's rules is not asked
  again.
- **Done is an empty frontier,** not a question count.

Send each round through the ask tool (AskUserQuestion): two to four named options per question, the
recommended one first, up to four questions per call. An answer that asks for clarification or
changes the frame is handled first, then the round is recomputed.

When the ask sounds like a solution, ask for the constraint under it. Take the person's words
literally: use the thing they named, and never swap in your own design. What an expert would add
beyond the ask goes into what the work is not, never into the epic. When the person already named
their own judge ("I test it on my desktop"), that is the judge; add no eval or test they did not
ask for.

## Decisions too big for this session

When the frontier is too wide to empty in one session, record each open decision as a child task of
the epic through the task tool, and settle one per session. If a decision contradicts the epic's
intent, return the conflict to the person; never edit the intent yourself.

## Write the epic

When the frontier is empty and the person asked for an epic, show in one reply: the settled
decisions, one line each; the intent (who it is for, what they do with it, what it is not); and the
acceptance criteria, each one a thing a run can show. Ask for the yes through the ask tool. Only
after the yes, write the intent and the criteria into the epic through the task tool. Then hand to
plan to split it. A fix has no epic: say so and stop.

## Red flags

- When the repository would answer it in one search, search, because asking hands your work to the
  person.
- When a criterion reads "works well" or "is clean", rewrite it as something a run shows.
- When a criterion is one the person never said, drop it.

## Say it in the reply

The round as an ask-tool call, recommendations included. When the frontier empties, the decisions,
the intent and the criteria for the yes; after it, the epic id and plan as the next step.
