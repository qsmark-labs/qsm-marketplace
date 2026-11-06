---
type: llm
focus: last_message
---

Intent of this eval: a plugin installs and works on its own, so in the C4 graph it is a container of
the system, never a container inside another container; the skill earns trust when the agent draws
the new plugin at its level with titled relations and proves the views before the spec.

PASS when the reply adds qsm-notify as a container of the system mp in models/marketplace.c4 with
its code path, says why the colleague's suggestion is wrong (a container sits in a system, not in a
container), gives each new relation a title and a technology (the CLI call to qsm-tasks, HTTPS to
the chat service), and its flow has lint, then render, then a look at the rendered views. The binary
is absent in this sandbox, so these are planned steps and a plan that names them passes. FAIL when
it nests qsm-notify inside qsm-tasks, adds a second model file, leaves a relation without a
technology, or plans no look at the views.
