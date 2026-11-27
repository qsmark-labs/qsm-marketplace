---
name: review
description: "Use for a one-agent strict review of a change that stays in the session: the working diff, a branch, a path set, or a pull or merge request you do not want posted on. Also for a readability score of a codebase or a skill. Triggers: review this, review the diff, quick review, strict review, look over my change, is this ready, is this readable, score this for clarity, how would this read to a new dev, zkontroluj to. Posts nothing. For a whole pull or merge request reviewed end to end and posted, use workflow-review."
---

# Solo review

You wrote the change, so you read it with the assumptions that wrote it. Hand it to the
`strict-reviewer` agent, a reader who has not seen it. It posts nothing and fixes nothing. A whole
PR or MR to be posted is workflow-review.

## Do

- Pin the base: the merge base of the default branch, unless the caller names a branch, paths or a
  request. Stop on an empty diff and say why it looks empty (uncommitted, wrong base, already
  merged).
- Dispatch `strict-reviewer` once with the base, the languages and the linked issue. Never review
  in your own context.
- Relay its report whole, never dropping or softening a finding.
- When the reviewer says the change is too big for one reader, name `workflow-review`.

## Readability score

Dispatch `readability-reviewer` with one path and one label. Relay its six dimensions and the
score out of ten. One run per top-level directory on a large tree, never an average.
