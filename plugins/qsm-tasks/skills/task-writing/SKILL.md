---
name: task-writing
description: "Use when the person asks to write the text of an epic, a task or an issue so a maintainer and a first-time contributor both understand it on the first read: its title, plain summary, before and after, done-when criteria, non-goals, decision. Triggers: write the ticket, write the issue, write the task, write the epic, rewrite this issue, make this issue clearer, good first issue, napis ticket, napis issue, popis task, napis epic. Not for the commands of the task tool (task-tool), not for commits, merge requests or READMEs (writing)."
---

# Task Writing

A task is the one document a stranger reads to decide "is this mine?" and then to do the work
without a meeting. This is the form of that text, whatever the tool stores (a GitHub or GitLab
issue today). It runs only when the person asked for the text. Write the sections the task needs;
drop any that would be empty.

## Skeleton

Sections in this order, each `##`.

1. Title: the result or problem in the user's words, under 80 characters ("Invoice PDF shows last
   month's address after a move", not "Address bug"). A decision task states the decision.
2. Plain summary, two to four sentences, no jargon: who is hurt or what is missing, and what is
   different after.
3. Before and after: the lightest picture that carries the change. Behaviour: a table of
   `input | today | after`. Text or output: two aligned code blocks. Flow: a mermaid diagram. UI: a
   screenshot pair.
4. Why now and what is not done: the need, the cost of doing nothing, and a `Not in this task` list
   naming what is likely confused with it.
5. Done when: a checkbox list, one testable fact per line, each an input and the exact expected
   result, with the fail path as its own line.
6. For maintainers: exact behaviour, bounds, edge cases, names, error codes; for a bug the numbered
   reproduction steps with exact input and wrong output. The cause is marked measured or guessed.
7. Decision, only when one was made: `Decision: X` first, then the options (including do nothing),
   each with why it lost.
8. Background and links: folded in `<details>`.

## Rules

- Write what the diff cannot show: the why, the rules, the non-goals, the failure behaviour. Never
  retell the diff.
- Plain words first, then the term, defined once; one word per concept.
- Say what the user observes, not the table or file that implements it.
- Give a vague word ("fast", "small") a number or delete it; ban "etc." and "handled".
- Every "Done when" line traces to the need in the plain summary; a line with no root there is cut.
- A table only for rows that compare; a list or a sentence otherwise.
- A bug names a measured cause only when a command's output proves it.
- Cut half, then half of what is left: no welcome, no "this issue tracks...".

## Example

```markdown
# Invoice PDF shows last month's address after a move

Customers who change their address still get invoices with the old one, so mail goes to the wrong
door. After this task the invoice shows the address valid on the invoice date.

## Before and after

| Customer | Moved on | Invoice date | Today | After |
| --- | --- | --- | --- | --- |
| 17 | 3 May | 10 May | Elm St 4 | Oak Rd 9 |
| 17 | 3 May | 1 May | Elm St 4 | Elm St 4 |

## Not in this task

The email template, tracked in #12.

## Done when

- [ ] Row 1 prints Oak Rd 9 and row 2 Elm St 4
- [ ] A customer with no address record fails with `ADDRESS_MISSING`, not a blank line
```

## Say it in the reply

One line above the text: who reads it and what they do after.
