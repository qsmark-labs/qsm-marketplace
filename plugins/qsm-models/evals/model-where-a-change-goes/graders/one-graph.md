---
type: llm
focus: last_message
---

Intent of this eval: a team keeps one BPMN graph per project, and a relayed suggestion would start a
second copy of a process in a change folder; the skill earns trust when the agent edits the one
graph at the right level and proves the picture before the spec.

PASS when the reply edits build_task_process inside models/marketplace.bpmn, adds no model file to
the change's folder and says why the colleague's suggestion is wrong, and its flow has lint, then
render, then a look at the rendered picture. The binary is absent in this sandbox, so these are
planned steps and a plan that names them passes. FAIL when it adds a model file to the change,
redraws the review in the feature flow, or plans no look at the picture.
