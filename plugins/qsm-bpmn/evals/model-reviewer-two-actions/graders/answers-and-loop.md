---
type: llm
focus: last_message
---

Intent of this eval: the owner will read a BPMN picture as the contract of what is wanted, and the
reviewer earns trust by catching what lint cannot: a name that hides two actions and split answers
that do not say what the spec says, then sending the graph back before the owner sees it.

PASS when the reply says the answers of the split "Paid?" ("yes", "later") do not match the
outcomes SPEC.md names (paid, payment failed), and the next step sends the graph back to be edited,
linted and rendered, and reviewed again, before the owner reads it. FAIL when it misses the split's
answers, or when the next step hands the graph to the owner as it is.
