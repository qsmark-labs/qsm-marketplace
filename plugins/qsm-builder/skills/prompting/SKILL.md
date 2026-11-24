---
name: prompting
description: "Use when writing, reviewing, or tightening a prompt, skill, agent, or system prompt for this marketplace: why a prompt opens with its purpose, how to write and use an iron law without misusing it, and maker notes on where models over- or under-do. Triggers: how should I phrase this prompt, tighten this system prompt, why does the model ignore this, should this be a rule, iron law, review this prompt, napis prompt. The quality bar for a skill is the skill-standards skill; the order of adding one is add-plugin."
---

# Prompting

A prompt is a handover to a reader who has none of your context. It works when that reader knows
why the task exists, what is out of scope and what done looks like, because then it decides well in
the case the prompt never named. This guide is for the person who writes or reviews our prompts
and wants to know why a line is there before how to phrase it. It is not a per-model rewriting
manual: we keep no per-model table because we have measured none, and a table repeated from a
vendor's page is a guess dressed as a rule. The shape of a skill is skill-standards.

## Why before how

- **Open with the purpose.** Who it serves, the outcome, what it refuses to do. The reader reads
  every later rule through that sentence, and a rule it cannot place is applied at random.
- **Give each instruction its reason.** "Run the real path, because a green gate only reads
  files" lets the reader handle the near case; "always run the real path" is applied to a typo
  fix. A rule whose reason you cannot write is deleted.
- **Say what done looks like.** Without it the reader stops early or never.
- **Ask for the smallest thing that does the job.** A reader that adds unasked tests, docs and
  refactors is doing what the prompt left open.
- **Prefer one positive example to a list of "never" lines.** A prohibition tells the reader what
  to avoid and nothing about what to do.
- **Plain imperatives, no capitals for emphasis.** Emphasis is read as "apply wider than you think"
  and the rule leaks into cases it was not written for.
- **A review prompt asks for every finding, then a second pass filters.** "Only the important ones"
  is obeyed literally and finds less.

## Iron laws

An iron law is a rule that holds every time, with no judgement left to the reader. Use one rarely.

- It fits where a miss is expensive or irreversible and the line is crisp: no secret in a commit,
  no write outside the worktree. If a judgement call is still needed, it is guidance, not a law.
- Write it with its reason in one sentence: the law and the harm it prevents.
- Enforce it where a miss is costly with a hook or a gate, because prose is forgotten under
  pressure.
- Keep the count small: ten laws are ten places to pause.

Misuse looks like this: a prohibition with no reason ("NEVER touch the database"), shouted, which
makes the reader refuse the harmless read as well; "always ask before X" as a blanket, which makes
an unattended agent stall; a law that is really a preference.

## Maker notes

What we have seen models do when a prompt leaves a gap. These are observations to check against
your own eval, not rules, and none is a claim about one model.

- Recent models over-apply emphasis and over-read a prohibition; hard "never" boundaries make some
  stop and ask where the person wanted them to go on.
- At low effort a model reports done without a real check, or adds tests, docs and files nobody
  asked for. Fix with a definition of done and "mention extras at the end", not with more emphasis.
- A model told to verify, to think carefully or to use a subagent to check does so at a cost, even
  when it already would have. Add such a line only when a run shows the miss.
- A prompt written for a strong model may leave a smaller one without the steps it needs. Test on
  the model that will run it.

Behaviour changes with the model version, so test a line on the model that will run it.

## Red flags

- When a prompt is full of capitals and "never" lines, rewrite it as purpose plus reasons, because
  emphasis without a reason is applied too wide.
- When a rule must hold every time and lives only in prose, name the hook that holds it, because
  prose is forgotten under pressure.
- When you cannot write a line's reason, delete the line, because it is a habit and not a rule.
