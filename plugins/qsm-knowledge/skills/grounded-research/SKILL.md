---
name: grounded-research
description: "Use when the person asks for deep research: a topic that needs several answers from several sources and an evidence base somebody will come back to. Triggers: deep dive into X, research this properly, investigate and document Y, build an evidence base for Z, run the research passes. Decomposes, queries the notebook in three passes, closes gaps with external research, and hands the findings on. Not the notebook itself (source-notebook), not note writing (vault-note)."
---

# Grounded research

This flow is the method for several questions over several sources, ending in an evidence base
that outlives the session: the notebook holds the sources, the vault holds the conclusions, and
this is the passage between them. It runs only when the person asked for deep research. It writes
no vault note. Where no web is available, the research plan is the part that counts.

## Decompose first

Write three to five sub-questions, each falsifiable on its own, before the first query. Add two:
where do the sources disagree, and what do the sources not cover.

## Three passes on the notebook

Ask inline; `source-notebook` owns the verbs and failure modes.

1. **Broad.** One query per sub-question. Read the citations, not only the prose.
2. **Sharp.** Follow what the broad pass surfaced.
3. **Adversarial.** Turn the strongest claim into a question that could kill it.

## A gap is a dispatch

When a pass returns thin citations or the notebook says its corpus does not cover a sub-question,
research that one gap on the web, add what comes back good to the notebook, and then continue.

Keep one findings file, appended as you go, each finding with its citation. When the person wants
notes, give the file to the `synthesis-pass` worker and each draft it returns to `vault-note`.

## Where no web or notebook is reachable

Write the plan so someone with access can run it: per sub-question, what you would search or ask,
which source kinds answer it, and how each claim will be grounded. Name the gaps you could not
close, because an answer from memory dressed as research is the failure this flow prevents.

## Done when

Every load-bearing claim cites a source. Contradictions stay written down as open questions, never
averaged. The gap sub-question was asked and answered.

## Say it in the reply

What was concluded; what stayed open; where the findings file and the notebook are. Not the
findings themselves.
