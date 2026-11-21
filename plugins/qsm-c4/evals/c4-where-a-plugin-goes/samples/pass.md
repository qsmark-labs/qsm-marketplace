Approach: qsm-notify installs and works on its own, so it is a container of the system mp with
metadata path 'plugins/qsm-notify', not a container inside qsm-tasks, which lint refuses. Flow: 1.
add the container and its relations, to qsm-tasks 'reads the open tasks' { technology 'exec, stdio'
} and to the chat service 'posts the merge message' { technology 'HTTPS, REST' }. 2. qsm-c4 lint. 3.
qsm-c4 render and look at the container views. 4. the model-reviewer reads the draft.
