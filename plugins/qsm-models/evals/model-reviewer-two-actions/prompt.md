---
name: model-reviewer-two-actions
runs: 3
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill, Agent]
---

Use the model-reviewer agent. Review my change to models/shop.bpmn against SPEC.md before the owner
reads the picture. The qsm-models binary is not installed in this sandbox, so lint and render
already passed elsewhere; read the source. Reply in this shape:

```text
Approach: <what you checked and why>
Findings: <one line per finding: the element id, what is wrong, the fix>
Next step: <one action>
```
