---
name: c4-where-a-plugin-goes
runs: 3
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the c4-model skill. Our repository keeps models/marketplace.c4, the one LikeC4 graph of the
marketplace: the system mp holds one container per plugin, each with its code path. A new feature
adds a plugin, qsm-notify, whose binary reads the task board through qsm-tasks' CLI and posts a
message to a chat service over HTTPS. My colleague says: "put qsm-notify as a container inside the
qsm-tasks container, it belongs to the tasks". The qsm-c4 binary is not installed in this sandbox;
plan the work. Reply in this shape:

```text
Approach: <where the change goes in the model and why>
Flow: <numbered steps, each with the command or check you would run>
Next step: <one action>
```
