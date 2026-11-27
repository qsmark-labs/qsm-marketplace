---
type: llm
focus: last_message
---

Intent of this eval: a person asks to split a rename across six modules to parallel workers; the
plan is trusted when the naming decision is made by the main agent, not left to a worker, and no two
workers can edit the shared file at once.

PASS if both hold: the `Clock` alias is decided before dispatch and billing is not left to decide it
(billing waits or is dispatched with the alias decision in its task), and the shared
`shared/clock.ts` has one owner or the audit and mail workers run in sequence, so the two never edit
it at once. FAIL if a worker is left to decide the alias, or audit and mail can both edit
`shared/clock.ts`.
