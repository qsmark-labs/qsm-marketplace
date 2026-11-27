---
name: source-notebook
description: "Use when work needs grounding in source material a person can open: putting sources into a notebook, asking it a question that comes back cited, and keeping it current. Triggers: ground this in sources, make a notebook for X, ask the notebook, what do my sources say about, add this paper to the notebook, is my notebook stale. Not the multi-pass research flow (grounded-research), not note writing (vault-note)."
---

# Source notebook

A notebook answers only from the sources you put in it, so every answer cites something a person
can open, or it does not come back. This skill picks the `nlm` verb to run. `nlm --help` lists the
verbs, so they are not restated. Ask the notebook inline, never through a subagent.

## Sources

- Prefer the primary source (paper, spec, maintainer) over a post about it.
- Run `nlm source list <notebook>` before relying on a source, because ingestion finishes after the
  add returns and a login page ingests as a login page.

## Asking

- Use `nlm generate-chat <notebook> "<question>"`, because it returns numbered references on a
  steadier path than the research verb. Use `nlm chat` only when the next question needs the last
  answer.
- Ask one named question at a time.
- An answer that cites one source repeatedly means the corpus does not cover the question: say so.

## Current

Run `nlm source check` then `nlm source refresh` before the notebook decides something. `source
check` knows only Google Drive sources, so refresh any other source that may have changed.

## When a query fails

Never fill the gap from memory.

| Failure | Do |
| --- | --- |
| Service unavailable for that query type | retry with `generate-chat` |
| Authentication failure | `nlm refresh`, then `nlm auth`, then retry |
| `nlm auth` shows `✗ No notebook.google.com cookies` | the person signs in once: `chromium --user-data-dir=$HOME/.config/google-chrome https://notebook.google.com/`, closes it, then `nlm auth` |
| Nothing answers | `qsm-knowledge doctor` |

## Say it in the reply

Name the notebook, the question as asked, and what the answer cited. When the corpus did not cover
it, say that first. When a query failed, name the failure and what you did.
