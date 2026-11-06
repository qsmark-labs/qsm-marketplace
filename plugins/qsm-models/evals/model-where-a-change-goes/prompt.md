---
name: model-where-a-change-goes
runs: 3
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the model skill. Our repository keeps models/marketplace.bpmn and models/marketplace.c4. The
BPMN graph has a main process feature_flow_process (the feature from request to main, steps 1 to 9,
whose step "4-6 Build every open task" is a call activity) and build_task_process, the loop that
builds, reviews and merges one task, called by that step. A new feature adds a second review round
to how one task is reviewed. My colleague says: "draw a new process for it in the change's own
openspec/changes/review-round/models/ folder, next to the feature flow". The qsm-models binary is
not installed in this sandbox; plan the work. Reply in this shape:

```text
Approach: <where the change goes in the models and why>
Flow: <numbered steps, each with the command or check you would run>
Next step: <one action>
```
